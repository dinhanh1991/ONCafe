import { supabase } from "../config/supabase.js";

export class CustomerProfileRepository {
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

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
