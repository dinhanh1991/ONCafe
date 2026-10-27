
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
            !Number.isFinite(price) ||
            !Number.isInteger(price) ||
            price < 0
        ) {
            errors.price = "Giá phải là số nguyên không âm.";
        }

        const quantity = Number(product.quantity);

        if (
            product.quantity === "" ||
            product.quantity === null ||
            product.quantity === undefined ||
            !Number.isInteger(quantity) ||
            quantity < 0
        ) {
            errors.quantity = "Số lượng phải là số nguyên không âm.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }
}
