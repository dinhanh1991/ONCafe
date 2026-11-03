// Cung cấp nghiệp vụ lấy thực đơn cho giao diện khách hàng.
export class CustomerMenuService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(repository) {
        if (!repository) throw new Error("CustomerMenuService cần CustomerMenuRepository.");
        this.repository = repository;
    }

    // Tải các sản phẩm đang được phép bán.
    async getAvailableProducts() {
        return this.repository.getAvailableProducts();
    }
}
