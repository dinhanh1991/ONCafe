import { ValidationUtils } from "./ValidationUtils.js";

export class ProductValidator {
    static validate(data) {
        const errors = {};
        const product = data && typeof data === "object" ? data : {};

        if (typeof product.name !== "string" || !product.name.trim()) {
            errors.name = "Tên sản phẩm không được để trống.";
        }

        if (typeof product.category !== "string" || !product.category.trim()) {
            errors.category = "Vui lòng chọn danh mục.";
        }

        const price = Number(product.price);

        if (
            product.price === "" ||
            product.price === null ||
            product.price === undefined ||
            !Number.isSafeInteger(price) ||
            price < 0
        ) {
            errors.price = "Giá phải là số nguyên không âm.";
        }

        // Tồn kho được phép bằng 0; số lượng đặt/mua phải lớn hơn 0.
        if (!ValidationUtils.isNonNegativeInteger(product.quantity)) {
            errors.quantity = "Số lượng tồn kho phải là số nguyên không âm.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}
