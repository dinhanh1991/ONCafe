import { supabase } from "../config/supabase.js";

export class EmployeeRepository {
    async getMyProfile() {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

        const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, phone, address, role")
            .eq("id", user.id)
            .single();

        if (error) throw error;
        return { ...data, email: user.email };
    }

    async updateMyProfile({ fullName, phone, address }) {
        const { data, error } = await supabase.rpc("oncafe_update_my_profile", {
            p_full_name: fullName,
            p_phone: phone,
            p_address: address
        });

        if (error) throw error;
        return data;
    }

    async changeMyPassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
    }
}
