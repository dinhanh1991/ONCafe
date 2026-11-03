// Chuẩn bị và gửi thông tin đặt hàng từ quy trình thanh toán.
import { CustomerQrPaymentService } from "./CustomerQrPaymentService.js";

export class CustomerCheckoutService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(orderRepository, qrPaymentService = new CustomerQrPaymentService()) {
        if (!orderRepository) throw new Error("CustomerCheckoutService cần CustomerOrderRepository.");
        this.orderRepository = orderRepository;
        this.qrPaymentService = qrPaymentService;
    }

    // Lấy thông tin tài khoản đang đăng nhập.
    async getCurrentUser() {
        return this.orderRepository.getCurrentUser();
    }

    // Lấy hồ sơ khách hàng theo mã tài khoản.
    async getCustomerProfile(userId) {
        return this.orderRepository.getCustomerProfile(userId);
    }

    // Kiểm tra dữ liệu và gửi yêu cầu tạo đơn hàng.
    async createOrder(orderDetails) {
        const order = await this.orderRepository.createOrder(orderDetails);
        if (!order?.order_code) {
            throw new Error("Hệ thống chưa trả về mã đơn hàng. Vui lòng kiểm tra mục đơn hàng trước khi đặt lại.");
        }
        return order;
    }

    // Chuẩn bị dữ liệu hiển thị mã QR và thông tin thanh toán.
    async createQrInfo(orderId, currentPageUrl) {
        const paymentData = await this.orderRepository.createQrPayment(orderId);
        return this.qrPaymentService.createQrInfo(paymentData, currentPageUrl, 220);
    }

    // Lấy trạng thái thanh toán của đơn hàng.
    async getOrderPaymentState(orderId) {
        return this.orderRepository.getOrderPaymentState(orderId);
    }
}
