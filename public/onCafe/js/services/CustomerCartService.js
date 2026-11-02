/**
 * CustomerCartService
 * Quản lý dữ liệu giỏ hàng và lưu trữ cục bộ cho khách hàng.
 */
export class CustomerCartService {
    constructor(storage = localStorage, storageKey = "oncafe-cart") {
        if (!storage) throw new Error("CustomerCartService cần storage.");
        this.storage = storage;
        this.storageKey = storageKey;
        this.items = this.load();
    }

    load() {
        try {
            const savedItems = JSON.parse(this.storage.getItem(this.storageKey) || "[]");
            return Array.isArray(savedItems) ? savedItems : [];
        } catch {
            return [];
        }
    }

    getItems() {
        return this.items.map((item) => ({ ...item }));
    }

    save() {
        this.storage.setItem(this.storageKey, JSON.stringify(this.items));
    }

    addProduct(product) {
        if (!product?.id) throw new Error("Sản phẩm không hợp lệ.");

        const stock = Number(product.quantity);
        if (stock < 1) throw new Error("Sản phẩm hiện đã hết hàng.");

        const existingItem = this.items.find((item) => item.id === product.id);
        if (existingItem) {
            if (existingItem.quantity >= stock) {
                throw new Error(`Số lượng ${product.name} trong giỏ đã đạt tồn kho hiện tại.`);
            }
            existingItem.quantity += 1;
        } else {
            this.items.push({
                id: product.id,
                name: product.name,
                price: Number(product.price),
                image_url: product.image_url || "",
                quantity: 1
            });
        }

        this.save();
        return this.getItems();
    }

    changeQuantity(productId, amount, availableProduct = null) {
        const item = this.items.find((cartItem) => cartItem.id === productId);
        if (!item) return this.getItems();

        if (amount > 0 && availableProduct
            && item.quantity >= Number(availableProduct.quantity)) {
            throw new Error(`Số lượng ${availableProduct.name} đã đạt tồn kho hiện tại.`);
        }

        item.quantity += amount;
        if (item.quantity <= 0) {
            this.removeProduct(productId);
            return this.getItems();
        }

        this.save();
        return this.getItems();
    }

    removeProduct(productId) {
        this.items = this.items.filter((item) => item.id !== productId);
        this.save();
        return this.getItems();
    }

    clear() {
        this.items = [];
        this.save();
        return this.getItems();
    }

    getTotalQuantity() {
        return this.items.reduce((total, item) => total + Number(item.quantity), 0);
    }

    getSubtotal() {
        return this.items.reduce(
            (total, item) => total + Number(item.price) * Number(item.quantity),
            0
        );
    }
}
