
import { Product } from "../models/Products.js";
import { ProductValidator } from "../validators/ProductValidator.js";

export class ProductService {
    constructor(productRepository) {
        this.productRepository = productRepository;
    }

    async getAllProducts() {
        return await this.productRepository.findAll();
    }

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

    async addProduct(data) {
        this.validate(data);

        const product = new Product(
            null,
            data.name.trim(),
            Number(data.price),
            data.category.trim(),
            Number(data.quantity),
            data.imageUrl || "",
            data.status || "active"
        );

        return await this.productRepository.save(product);
    }

    async updateProduct(id, data) {
        await this.getProductById(id);
        this.validate(data);

        const updatedData = {
            name: data.name.trim(),
            price: Number(data.price),
            category: data.category.trim(),
            quantity: Number(data.quantity),
            imageUrl: data.imageUrl || "",
            status: data.status || "active"
        };

        return await this.productRepository.update(Number(id), updatedData);
    }

    async deleteProduct(id) {
        await this.getProductById(id);
        return await this.productRepository.delete(Number(id));
    }

    validate(data) {
        const result = ProductValidator.validate(data);

        if (!result.isValid) {
            const error = new Error("Dữ liệu sản phẩm không hợp lệ.");
            error.validationErrors = result.errors;
            throw error;
        }
    }
}
