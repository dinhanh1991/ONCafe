// Đọc và cập nhật thông tin hồ sơ khách hàng.
import { supabase } from "../config/supabase.js";

export class CustomerProfileRepository {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    // Lấy hồ sơ của người dùng hiện tại.
    async getMyProfile(userId) {
        const { data, error } = await this.supabase
            .from("profiles")
            .select("full_name, phone, address, role")
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Không tìm thấy hồ sơ tài khoản. Vui lòng liên hệ cửa hàng.");
        return data;
    }

    // Lưu các thay đổi hồ sơ của khách hàng.
    async updateMyProfile({ fullName, phone, address }) {
        const { data, error } = await this.supabase.rpc("oncafe_update_my_profile", {
            p_full_name: fullName,
            p_phone: phone,
            p_address: address
        });

        if (error) throw error;
        return data;
    }
}
