
export class Product {
    constructor(
        id,
        name,
        price,
        category,
        quantity,
        imageUrl = "",
        status = "active"
    ) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.category = category;
        this.quantity = quantity;
        this.imageUrl = imageUrl;
        this.status = status;
    }

    getFormattedPrice() {
        return this.price.toLocaleString("vi-VN") + " VNĐ";
    }

    isAvailable() {
        return this.status === "active";
    }
}
