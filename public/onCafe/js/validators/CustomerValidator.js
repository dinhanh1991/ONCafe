// Kiểm tra dữ liệu đầu vào của hồ sơ khách hàng.
import { ValidationUtils } from "./ValidationUtils.js";

export class CustomerValidator {
    // Kiểm tra tính hợp lệ của dữ liệu đầu vào.
    static validate(data = {}, { phoneRequired = false } = {}) {
        const errors = {};
        const phone = String(data.phone ?? "").trim();

        if (phoneRequired && !phone) {
            errors.phone = "Vui lòng nhập số điện thoại.";
        } else if (phone && !ValidationUtils.isValidVietnamPhone(phone)) {
            errors.phone = "Số điện thoại không hợp lệ. Hãy nhập số di động Việt Nam gồm 10 chữ số hoặc dạng +84.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}
