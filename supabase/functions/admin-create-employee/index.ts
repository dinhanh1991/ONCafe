import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Chỉ hỗ trợ POST." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        return jsonResponse({ error: "Máy chủ chưa được cấu hình đầy đủ." }, 500);
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Bạn cần đăng nhập." }, 401);
    }

    try {
        const token = authorization.slice("Bearer ".length);
        const authClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authorization } },
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        if (userError || !userData.user) {
            return jsonResponse({ error: "Phiên đăng nhập không hợp lệ." }, 401);
        }

        const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: actorProfile, error: actorError } = await adminClient
            .from("profiles")
            .select("role")
            .eq("id", userData.user.id)
            .single();

        if (actorError || actorProfile?.role !== "admin") {
            return jsonResponse({ error: "Chỉ quản trị viên mới được tạo tài khoản nhân viên." }, 403);
        }

        const body = await request.json();
        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const role = body.role;

        if (fullName.length < 2 || fullName.length > 100) {
            return jsonResponse({ error: "Họ tên phải từ 2 đến 100 ký tự." }, 400);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return jsonResponse({ error: "Email không hợp lệ." }, 400);
        }
        if (password.length < 8 || password.length > 72) {
            return jsonResponse({ error: "Mật khẩu phải từ 8 đến 72 ký tự." }, 400);
        }
        if (role !== "cashier") {
            return jsonResponse({ error: "Hiện chỉ cho phép tạo nhân viên với vai trò thu ngân." }, 400);
        }

        const { data: createdData, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        });
        if (createError || !createdData.user) {
            return jsonResponse({ error: createError?.message || "Không thể tạo tài khoản nhân viên." }, 400);
        }

        const { error: profileError } = await adminClient
            .from("profiles")
            .upsert({
                id: createdData.user.id,
                full_name: fullName,
                role: "cashier"
            }, { onConflict: "id" });

        if (profileError) {
            await adminClient.auth.admin.deleteUser(createdData.user.id);
            return jsonResponse({ error: "Không thể tạo hồ sơ nhân viên. Tài khoản vừa tạo đã được hoàn tác." }, 500);
        }

        return jsonResponse({
            message: "Đã tạo tài khoản thu ngân. Hãy cung cấp email đăng nhập và mật khẩu ban đầu cho nhân viên một cách an toàn.",
            employee: { id: createdData.user.id, full_name: fullName, email, role: "cashier" }
        }, 201);
    } catch (error) {
        console.error("admin-create-employee:", error);
        return jsonResponse({ error: "Có lỗi máy chủ khi tạo tài khoản nhân viên." }, 500);
    }
});
