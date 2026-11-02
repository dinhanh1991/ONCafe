import { ValidationUtils } from "./ValidationUtils.js";

export class EmployeeValidator {
    static validate(data = {}) {
        const errors = {};
        const fullName = String(data.fullName ?? "").trim();
        const email = String(data.email ?? "").trim();

        if (fullName.length < 2) {
            errors.fullName = "Họ và tên phải có ít nhất 2 ký tự.";
        }

        if (!ValidationUtils.isValidEmail(email)) {
            errors.email = "Email không đúng định dạng. Ví dụ: nhanvien@gmail.com.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}
