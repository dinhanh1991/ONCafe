import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return hex(new Uint8Array(digest));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Server configuration is incomplete" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: { action?: string; order_id?: number; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "create") {
    const authorization = req.headers.get("Authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "");
    if (!jwt || jwt === authorization) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const orderId = Number(body.order_id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return json({ error: "Invalid order" }, 400);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, order_code, payment_method, payment_status, status, created_by, order_source")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError || !order) return json({ error: "Order not found" }, 404);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError || !profile) return json({ error: "Forbidden" }, 403);

    const isStaff = ["admin", "seller", "cashier"].includes(profile.role);
    const isOrderOwner = profile.role === "customer" &&
      order.order_source === "online" &&
      order.created_by === userData.user.id;
    if (!isStaff && !isOrderOwner) return json({ error: "Forbidden" }, 403);

    if (order.payment_method !== "qr" || order.payment_status !== "unpaid" ||
        order.status !== "pending") {
      return json({ error: "Order is not eligible for QR confirmation" }, 409);
    }

    const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = hex(tokenBytes);
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await admin.from("order_payment_tokens").upsert({
      order_id: orderId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      used_at: null,
      created_by: userData.user.id,
    }, { onConflict: "order_id" });
    if (insertError) return json({ error: "Could not create QR token" }, 500);

    return json({
      order_code: order.order_code,
      token,
      expires_at: expiresAt,
    });
  }

  if (body.action === "confirm") {
    const token = typeof body.token === "string" ? body.token : "";
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "Invalid or expired QR code" }, 400);
    const { data, error } = await admin.rpc("oncafe_public_confirm_qr_payment", {
      p_token_hash: await hashToken(token),
    });
    if (error) return json({ error: "Could not confirm payment" }, 500);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) return json({ error: "QR code expired, already used, or order unavailable" }, 409);
    return json({ confirmed: true, order_code: result.order_code, total_amount: result.total_amount });
  }

  return json({ error: "Unknown action" }, 400);
});
