// Định nghĩa dữ liệu sản phẩm đồ uống được dùng trong ứng dụng.

export class Product {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
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

    // Trả về giá sản phẩm đã được định dạng tiền tệ.
    getFormattedPrice() {
        return this.price.toLocaleString("vi-VN") + " VNĐ";
    }

    // Kiểm tra sản phẩm còn được phép bán hay không.
    isAvailable() {
        return this.status === "active";
    }
}
