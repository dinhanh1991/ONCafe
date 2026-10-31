import { supabase } from "../config/supabase.js";
import { EmployeeRepository } from "../repositories/EmployeeRepo.js";

export class EmployeeService {
    constructor(repository = null, supabaseClient = supabase) {
        this.supabase = supabaseClient;
        this.repository = repository ?? new EmployeeRepository(supabaseClient);
    }

    async getMyProfile() {
        return this.repository.getMyProfile();
    }

    async updateMyProfile(profile) {
        const fullName = String(profile.fullName || "").trim();
        const phone = String(profile.phone || "").trim();
        const address = String(profile.address || "").trim();
        if (fullName.length < 2 || fullName.length > 100) {
            throw new Error("Họ và tên phải có từ 2 đến 100 ký tự.");
        }
        if (phone.length > 25) throw new Error("Số điện thoại không được vượt quá 25 ký tự.");
        if (address.length > 250) throw new Error("Địa chỉ không được vượt quá 250 ký tự.");
        return this.repository.updateMyProfile({ fullName, phone, address });
    }

    async changeMyPassword(password) {
        if (typeof password !== "string" || password.length < 8 || password.length > 72) {
            throw new Error("Mật khẩu cần có từ 8 đến 72 ký tự.");
        }
        return this.repository.changeMyPassword(password);
    }

    async listEmployees() {
        const data = await this.invoke({ action: "list" });
        return data.employees;
    }

    async createEmployee(employee) {
        const data = await this.invoke({ action: "create", ...employee });
        return data.employee;
    }

    async updateEmployee(employee) {
        const data = await this.invoke({ action: "update", ...employee });
        return data.employee;
    }

    async deleteEmployee(id) {
        await this.invoke({ action: "delete", id });
    }

    async invoke(body) {
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
