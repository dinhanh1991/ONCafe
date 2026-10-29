import { createClient } from "npm:@supabase/supabase-js@2";

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

function isValidEmail(email: string) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
        const authClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authorization } },
            auth: { persistSession: false, autoRefreshToken: false }
        });
        const token = authorization.slice("Bearer ".length);
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
            return jsonResponse({ error: "Chỉ quản trị viên mới được quản lý nhân viên." }, 403);
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: "Nội dung yêu cầu không hợp lệ." }, 400);
        }
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return jsonResponse({ error: "Nội dung yêu cầu không hợp lệ." }, 400);
        }
        const action = body?.action;

        if (action === "list") {
            const { data: profiles, error: profilesError } = await adminClient
                .from("profiles")
                .select("id, full_name, role")
                .eq("role", "cashier")
                .order("full_name", { ascending: true });
            if (profilesError) {
                console.error("Không thể tải hồ sơ nhân viên:", profilesError);
                return jsonResponse({ error: "Không thể tải danh sách nhân viên." }, 500);
            }

            const users = [];
            const perPage = 1000;
            for (let page = 1; ; page += 1) {
                const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
                if (error) {
                    console.error("Không thể tải tài khoản nhân viên:", error);
                    return jsonResponse({ error: "Không thể tải danh sách tài khoản nhân viên." }, 500);
                }
                users.push(...data.users);
                if (data.users.length < perPage) break;
            }
            const usersById = new Map(users.map((user) => [user.id, user]));
            const employees = (profiles ?? []).map((profile) => {
                const user = usersById.get(profile.id);
                return {
                    id: profile.id,
                    full_name: profile.full_name ?? "",
                    email: user?.email ?? "",
                    role: profile.role
                };
            });
            return jsonResponse({ employees });
        }

        if (action === "create") {
            const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
            const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
            const password = typeof body.password === "string" ? body.password : "";
            if (fullName.length < 2 || fullName.length > 100) {
                return jsonResponse({ error: "Họ tên phải từ 2 đến 100 ký tự." }, 400);
            }
            if (!isValidEmail(email)) {
                return jsonResponse({ error: "Email không hợp lệ." }, 400);
            }
            if (password.length < 8 || password.length > 72) {
                return jsonResponse({ error: "Mật khẩu phải từ 8 đến 72 ký tự." }, 400);
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
                .upsert({ id: createdData.user.id, full_name: fullName, role: "cashier" }, { onConflict: "id" });
            if (profileError) {
                console.error("Không thể tạo hồ sơ nhân viên:", profileError);
                const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdData.user.id);
                if (rollbackError) {
                    console.error("Không thể hoàn tác tài khoản nhân viên:", rollbackError);
                    return jsonResponse({
                        error: "Không thể tạo hồ sơ và không thể tự động hoàn tác tài khoản. Vui lòng kiểm tra danh sách người dùng trong Supabase."
                    }, 500);
                }
                return jsonResponse({ error: "Không thể tạo hồ sơ nhân viên." }, 500);
            }

            return jsonResponse({
                employee: { id: createdData.user.id, full_name: fullName, email, role: "cashier" }
            }, 201);
        }

        if (action === "update") {
            const id = typeof body.id === "string" ? body.id : "";
            const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
            const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
            const password = typeof body.password === "string" ? body.password : "";
            if (!id) return jsonResponse({ error: "Thiếu mã nhân viên." }, 400);
            if (fullName.length < 2 || fullName.length > 100) {
                return jsonResponse({ error: "Họ tên phải từ 2 đến 100 ký tự." }, 400);
            }
            if (!isValidEmail(email)) {
                return jsonResponse({ error: "Email không hợp lệ." }, 400);
            }
            if (password && (password.length < 8 || password.length > 72)) {
                return jsonResponse({ error: "Mật khẩu mới phải từ 8 đến 72 ký tự." }, 400);
            }

            const { data: profile, error: profileError } = await adminClient
                .from("profiles")
                .select("id, full_name, role")
                .eq("id", id)
                .eq("role", "cashier")
                .maybeSingle();
            if (profileError || !profile) {
                return jsonResponse({ error: "Không tìm thấy nhân viên cần cập nhật." }, 404);
            }
            const { data: currentUserData, error: currentUserError } =
                await adminClient.auth.admin.getUserById(id);
            if (currentUserError || !currentUserData.user) {
                return jsonResponse({ error: "Không tìm thấy tài khoản đăng nhập của nhân viên." }, 404);
            }

            const { error: profileUpdateError } = await adminClient
                .from("profiles")
                .update({ full_name: fullName })
                .eq("id", id)
                .eq("role", "cashier");
            if (profileUpdateError) {
                console.error("Không thể cập nhật hồ sơ nhân viên:", profileUpdateError);
                return jsonResponse({ error: "Không thể cập nhật hồ sơ nhân viên." }, 500);
            }

            const updateAttributes: {
                email: string;
                email_confirm: boolean;
                user_metadata: Record<string, unknown>;
                password?: string;
            } = {
                email,
                email_confirm: true,
                user_metadata: { ...currentUserData.user.user_metadata, full_name: fullName }
            };
            if (password) updateAttributes.password = password;

            const { data: updatedUserData, error: authUpdateError } =
                await adminClient.auth.admin.updateUserById(id, updateAttributes);
            if (authUpdateError || !updatedUserData.user) {
                console.error("Không thể cập nhật tài khoản nhân viên:", authUpdateError);
                const { error: rollbackError } = await adminClient
                    .from("profiles")
                    .update({ full_name: profile.full_name })
                    .eq("id", id);
                if (rollbackError) {
                    console.error("Không thể hoàn tác hồ sơ nhân viên:", rollbackError);
                    return jsonResponse({
                        error: "Không thể cập nhật tài khoản và không thể hoàn tác hồ sơ nhân viên. Vui lòng kiểm tra lại thông tin trong Supabase."
                    }, 500);
                }
                return jsonResponse({ error: authUpdateError?.message || "Không thể cập nhật tài khoản nhân viên." }, 400);
            }

            return jsonResponse({
                employee: { id, full_name: fullName, email: updatedUserData.user.email, role: "cashier" }
            });
        }

        if (action === "delete") {
            const id = typeof body.id === "string" ? body.id : "";
            if (!id) return jsonResponse({ error: "Thiếu mã nhân viên." }, 400);

            const { data: profile, error: profileError } = await adminClient
                .from("profiles")
                .select("id")
                .eq("id", id)
                .eq("role", "cashier")
                .maybeSingle();
            if (profileError || !profile) {
                return jsonResponse({ error: "Không tìm thấy nhân viên cần xóa." }, 404);
            }

            const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(id);
            if (deleteUserError) {
                console.error("Không thể xóa tài khoản nhân viên:", deleteUserError);
                return jsonResponse({ error: deleteUserError.message || "Không thể xóa tài khoản nhân viên." }, 400);
            }

            const { error: deleteProfileError } = await adminClient.from("profiles").delete().eq("id", id);
            if (deleteProfileError) {
                console.error("Tài khoản đã xóa nhưng không thể dọn hồ sơ nhân viên:", deleteProfileError);
                return jsonResponse({ error: "Tài khoản đã bị xóa nhưng không thể dọn hồ sơ nhân viên. Vui lòng liên hệ quản trị hệ thống." }, 500);
            }
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: "Thao tác quản lý nhân viên không hợp lệ." }, 400);
    } catch (error) {
        console.error("admin-manage-employees:", error);
        return jsonResponse({ error: "Có lỗi máy chủ khi quản lý nhân viên." }, 500);
    }
});
