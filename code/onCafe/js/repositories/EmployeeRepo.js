import { supabase } from "../config/supabase.js";

export class EmployeeRepository {
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    async getMyProfile() {
        const { data: { user }, error: userError } = await this.supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

        const { data, error } = await this.supabase
            .from("profiles")
            .select("id, full_name, phone, address, role")
            .eq("id", user.id)
            .single();

        if (error) throw error;
        return { ...data, email: user.email };
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

    async changeMyPassword(password) {
        const { error } = await this.supabase.auth.updateUser({ password });
        if (error) throw error;
    }

    async listEmployees() {
        const data = await this.invokeEmployeeFunction({ action: "list" });
        return data.employees;
    }

    async createEmployee(employee) {
        const data = await this.invokeEmployeeFunction({ action: "create", ...employee });
        return data.employee;
    }

    async updateEmployee(employee) {
        const data = await this.invokeEmployeeFunction({ action: "update", ...employee });
        return data.employee;
    }

    async deleteEmployee(id) {
        await this.invokeEmployeeFunction({ action: "delete", id });
    }

    async invokeEmployeeFunction(body) {
        const { data, error } = await this.supabase.functions.invoke("admin-manage-employees", {
            body
        });

        if (error) {
            if (error.context instanceof Response) {
                const payload = await error.context.clone().json().catch(() => null);
                if (typeof payload?.error === "string") {
                    throw new Error(payload.error);
                }
            }
            throw error;
        }

        if (data?.error) throw new Error(data.error);
        return data;
    }
}
