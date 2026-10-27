export class ProductRepository {
    constructor() {
        this.products = [
            {
                id: 1,
                name: "Bạc xỉu",
                price: 35000,
                category: "Cà phê",
                quantity: 20,
                imageUrl: "./assets/images/bac-xiu.jpg",
                status: "active"
            },
            {
                id: 2,
                name: "Trà đào",
                price: 40000,
                category: "Trà",
                quantity: 15,
                imageUrl: "./assets/images/tra-dao.jpg",
                status: "active"
            },
            {
                id: 3,
                name: "Trà sữa",
                price: 45000,
                category: "Trà sữa",
                quantity: 10,
                imageUrl: "./assets/images/tra-sua.jpg",
                status: "active"
            }
        ];
    }

    async findAll() {
        return [...this.products];
    }

    async findById(id) {
        const normalizedId = Number(id);
        if (!Number.isFinite(normalizedId)) return null;

        return this.products.find(
            product => product.id === normalizedId
        ) || null;
    }

    async save(product) {
        const newId = this.products.length > 0
            ? Math.max(...this.products.map(item => item.id)) + 1
            : 1;

        const newProduct = {
            ...product,
            id: newId
        };

        this.products.push(newProduct);
        return newProduct;
    }

    async update(id, updatedData) {
        const normalizedId = Number(id);
        const index = this.products.findIndex(
            product => product.id === normalizedId
        );

        if (index === -1) {
            throw new Error("Không tìm thấy sản phẩm.");
        }

        this.products[index] = {
            ...this.products[index],
            ...updatedData,
            id: normalizedId
        };

        return this.products[index];
    }

    async delete(id) {
        const normalizedId = Number(id);
        const index = this.products.findIndex(
            product => product.id === normalizedId
        );

        if (index === -1) {
            throw new Error("Không tìm thấy sản phẩm.");
        }

        this.products.splice(index, 1);
        return true;
    }
}
