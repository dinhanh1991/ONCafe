/**
 * Các hàm kiểm tra dữ liệu dùng chung trong ONCafe.
 * Không phụ thuộc thư viện bên ngoài.
 */
export class ValidationUtils {
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

    static normalizeVietnamPhone(value) {
        const phone = String(value ?? "").trim().replace(/[\s().-]/g, "");
        return phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
    }

    static isValidVietnamPhone(value) {
        const phone = this.normalizeVietnamPhone(value);
        return /^0[35789]\d{8}$/.test(phone);
    }

    static isPositiveInteger(value) {
        if (value === "" || value === null || value === undefined) return false;
        if (typeof value === "string" && !/^\d+$/.test(value.trim())) return false;

        const number = Number(value);
        return Number.isSafeInteger(number) && number > 0;
    }

    static isNonNegativeInteger(value) {
        if (value === "" || value === null || value === undefined) return false;
        if (typeof value === "string" && !/^\d+$/.test(value.trim())) return false;

        const number = Number(value);
        return Number.isSafeInteger(number) && number >= 0;
    }
}
