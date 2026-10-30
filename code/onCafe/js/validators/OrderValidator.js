import { ValidationUtils } from "./ValidationUtils.js";

export class OrderValidator {
    static validateItems(items) {
        const errors = {};

        if (!Array.isArray(items) || items.length === 0) {
            errors.items = "Đơn hàng phải có ít nhất một sản phẩm.";
        } else if (items.some((item) => !ValidationUtils.isPositiveInteger(item?.quantity))) {
            errors.items = "Số lượng mỗi sản phẩm phải là số nguyên lớn hơn 0.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}
