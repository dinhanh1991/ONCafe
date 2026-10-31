import { EmployeeRepository } from "../repositories/EmployeeRepo.js";

export class EmployeeService {
    constructor(repository = new EmployeeRepository()) {
        this.repository = repository;
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
        if (phone.length > 25) {
            throw new Error("Số điện thoại không được vượt quá 25 ký tự.");
        }
        if (address.length > 250) {
            throw new Error("Địa chỉ không được vượt quá 250 ký tự.");
        }

        return this.repository.updateMyProfile({ fullName, phone, address });
    }

    async changeMyPassword(password) {
        if (typeof password !== "string" || password.length < 8 || password.length > 72) {
            throw new Error("Mật khẩu cần có từ 8 đến 72 ký tự.");
        }
        return this.repository.changeMyPassword(password);
    }

    async listEmployees() {
        return this.repository.listEmployees();
    }

    async createEmployee(employee) {
        return this.repository.createEmployee(employee);
    }

    async updateEmployee(employee) {
        return this.repository.updateEmployee(employee);
    }

    async deleteEmployee(id) {
        return this.repository.deleteEmployee(id);
    }
}
