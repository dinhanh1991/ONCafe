import { ValidationUtils } from "./ValidationUtils.js";
import { CustomerValidator } from "./CustomerValidator.js";

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

    /**
     * Kiểm tra dữ liệu đầu vào của đơn hàng tại quầy.
     * Trả về lỗi theo tên field để View hiển thị, không thao tác DOM.
     */
    static validateCounterOrder({ items = [], customerPhone = "" } = {}) {
        const errors = {};

        if (!Array.isArray(items) || items.length === 0) {
            errors.items = "Đơn hàng phải có ít nhất một sản phẩm.";
        } else {
            for (const item of items) {
                if (!ValidationUtils.isPositiveInteger(item?.quantity)) {
                    errors[`quantity_${item.id}`] = "Số lượng phải là số nguyên lớn hơn 0.";
                }
            }
        }

        const phoneValidation = CustomerValidator.validate({ phone: customerPhone });
        if (!phoneValidation.isValid) {
            errors.customerPhone = phoneValidation.errors.phone;
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}
