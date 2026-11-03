// Cung cấp các thao tác nghiệp vụ cho lịch sử đơn của khách.
export class CustomerMyOrdersService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(orderRepository) {
        if (!orderRepository) throw new Error("CustomerMyOrdersService cần CustomerOrderRepository.");
        this.orderRepository = orderRepository;
    }

    // Lấy thông tin tài khoản đang đăng nhập.
    async getCurrentUser() {
        return this.orderRepository.getCurrentUser();
    }

    // Lấy danh sách đơn hàng của khách hàng đang đăng nhập.
    async getMyOrders() {
        return this.orderRepository.getMyOrders();
    }

    // Tạo thông tin yêu cầu thanh toán QR.
    async createQrPayment(orderId) {
        return this.orderRepository.createQrPayment(orderId);
    }

    // Gửi yêu cầu hủy đơn hàng của khách.
    async cancelMyOrder(orderId) {
        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            throw new Error("Mã đơn hàng không hợp lệ.");
        }
        return this.orderRepository.cancelMyOrder(orderId);
    }
}
