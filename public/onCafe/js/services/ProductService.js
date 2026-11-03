// Kiểm tra dữ liệu và điều phối nghiệp vụ quản lý sản phẩm.

import { Product } from "../models/Products.js";
import { ProductValidator } from "../validators/ProductValidator.js";

export class ProductService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(productRepository) {
        this.productRepository = productRepository;
    }

    // Lấy tất cả sản phẩm phục vụ báo cáo.
    async getAllProducts() {
        return await this.productRepository.findAll();
    }

    // Tìm sản phẩm theo mã và báo lỗi nếu không tìm thấy.
    async getProductById(id) {
        if (id === null || id === undefined || id === "") {
            throw new Error("Mã sản phẩm không hợp lệ.");
        }

        const product = await this.productRepository.findById(Number(id));

        if (!product) {
            throw new Error("Không tìm thấy sản phẩm.");
        }

        return product;
    }

    // Kiểm tra và thêm sản phẩm mới vào danh mục.
    async addProduct(data) {
        this.validate(data);

        let imageUrl = "";
        if (data.imageFile) {
            imageUrl = await this.productRepository.uploadImage(data.imageFile);
        }

        const product = new Product(
            null,
            data.name.trim(),
            Number(data.price),
            data.category.trim(),
            Number(data.quantity),
            imageUrl,
            data.status || "active"
        );

        return await this.productRepository.save(product);
    }

    // Lưu các thay đổi thông tin sản phẩm.
    async updateProduct(id, data) {
        const existingProduct = await this.getProductById(id);
        this.validate(data);

        let imageUrl = existingProduct.imageUrl || "";

        if (data.imageFile) {
            imageUrl = await this.productRepository.uploadImage(data.imageFile);
        }

        const updatedData = {
            name: data.name.trim(),
            price: Number(data.price),
            category: data.category.trim(),
            quantity: Number(data.quantity),
            imageUrl,
            status: data.status || "active"
        };

        return await this.productRepository.update(Number(id), updatedData);
    }

    // Xóa sản phẩm sau khi xác nhận.
    async deleteProduct(id) {
        await this.getProductById(id);
        return await this.productRepository.delete(Number(id));
    }

    // Kiểm tra tính hợp lệ của dữ liệu đầu vào.
    validate(data) {
        const result = ProductValidator.validate(data);

        if (!result.isValid) {
            const error = new Error(Object.values(result.errors).join(" "));
            error.validationErrors = result.errors;
            throw error;
        }
    }
}
