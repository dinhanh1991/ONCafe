/**
 * Các hàm kiểm tra dữ liệu dùng chung trong ONCafe.
 * Không phụ thuộc thư viện bên ngoài.
 */
export class ValidationUtils {
    // Kiểm tra định dạng địa chỉ email.
    static isValidEmail(value) {
        const email = String(value ?? "").trim();
        if (!email || email.length > 254) return false;

        const parts = email.split("@");
        if (parts.length !== 2) return false;

        const [localPart, domain] = parts;
        if (
            !localPart ||
            localPart.length > 64 ||
            localPart.startsWith(".") ||
            localPart.endsWith(".") ||
            localPart.includes("..")
        ) {
            return false;
        }

        const localPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
        const domainPattern = /^[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

        return localPattern.test(localPart) && domainPattern.test(domain);
    }

    // Chuẩn hóa số điện thoại về định dạng Việt Nam.
    static normalizeVietnamPhone(value) {
        const phone = String(value ?? "").trim().replace(/[\s().-]/g, "");
        return phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
    }

    // Kiểm tra số điện thoại có đúng định dạng Việt Nam hay không.
    static isValidVietnamPhone(value) {
        const phone = this.normalizeVietnamPhone(value);
        return /^0[35789]\d{8}$/.test(phone);
    }

    // Kiểm tra giá trị có phải số nguyên dương hay không.
    static isPositiveInteger(value) {
        if (value === "" || value === null || value === undefined) return false;
        if (typeof value === "string" && !/^\d+$/.test(value.trim())) return false;

        const number = Number(value);
        return Number.isSafeInteger(number) && number > 0;
    }

    // Kiểm tra giá trị có phải số nguyên không âm hay không.
    static isNonNegativeInteger(value) {
        if (value === "" || value === null || value === undefined) return false;
        if (typeof value === "string" && !/^\d+$/.test(value.trim())) return false;

        const number = Number(value);
        return Number.isSafeInteger(number) && number >= 0;
    }
}
