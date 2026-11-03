import { supabase } from "../config/supabase.js";

/**
 * AuthRepository
 * Chịu trách nhiệm giao tiếp với Supabase Auth và bảng profiles.
 */
export class AuthRepository {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    // Tạo tài khoản khách hàng mới.
    async register({ fullName, email, password }) {
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;
        return data;
    }

    // Xác thực tài khoản và tạo phiên đăng nhập.
    async login({ email, password }) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    }

    // Gửi email chứa liên kết đặt lại mật khẩu.
    async sendPasswordResetEmail(email, redirectTo) {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
            redirectTo
        });
        if (error) throw error;
    }

    // Cập nhật mật khẩu cho tài khoản hiện tại.
    async updatePassword(password) {
        const { error } = await this.supabase.auth.updateUser({ password });
        if (error) throw error;
    }

    // Lấy hồ sơ của người dùng hiện tại.
    async getMyProfile(userId) {
        const { data, error } = await this.supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", userId)
            .single();

        if (error) throw error;
        return data;
    }

    // Lấy hồ sơ của người dùng nếu hồ sơ đã tồn tại.
    async getMyProfileIfExists(userId) {
        const { data, error } = await this.supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    // Kết thúc phiên đăng nhập hiện tại.
    async logout() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    // Lấy phiên đăng nhập hiện tại.
    async getCurrentSession() {
        const { data, error } = await this.supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    }

    // Đăng ký nhận thông báo khi trạng thái xác thực thay đổi.
    onAuthStateChange(callback) {
        return this.supabase.auth.onAuthStateChange(callback);
    }

    // Lấy thông tin tài khoản đang đăng nhập.
    async getCurrentUser() {
        const { data, error } = await this.supabase.auth.getUser();
        if (error) throw error;
        return data.user;
    }
}
