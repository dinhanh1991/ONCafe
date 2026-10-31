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

        if (product.imageFile) {
            const imageResult = this.validateImageFile(product.imageFile);
            if (!imageResult.isValid) {
                errors.imageFile = imageResult.message;
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    static validateImageFile(file) {
        if (typeof File === "undefined" || !(file instanceof File)) {
            return {
                isValid: false,
                message: "Vui lòng chọn ảnh sản phẩm từ máy tính."
            };
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            return {
                isValid: false,
                message: "Ảnh phải có định dạng JPG, PNG, WEBP hoặc GIF."
            };
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return {
                isValid: false,
                message: "Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn."
            };
        }

        return { isValid: true, message: "" };
    }
}
