import { supabase } from "../config/supabase.js";

export class EmployeeService {
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
        const { data, error } = await supabase.functions.invoke("admin-manage-employees", {
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
