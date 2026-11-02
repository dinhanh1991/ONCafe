import { CustomerQrPaymentService } from "./CustomerQrPaymentService.js";

export class CustomerCheckoutService {
    constructor(orderRepository, qrPaymentService = new CustomerQrPaymentService()) {
        if (!orderRepository) throw new Error("CustomerCheckoutService cần CustomerOrderRepository.");
        this.orderRepository = orderRepository;
        this.qrPaymentService = qrPaymentService;
    }

    async getCurrentUser() {
        return this.orderRepository.getCurrentUser();
    }

    async getCustomerProfile(userId) {
        return this.orderRepository.getCustomerProfile(userId);
    }

    async createOrder(orderDetails) {
        const order = await this.orderRepository.createOrder(orderDetails);
        if (!order?.order_code) {
            throw new Error("Hệ thống chưa trả về mã đơn hàng. Vui lòng kiểm tra mục đơn hàng trước khi đặt lại.");
        }
        return order;
    }

    async createQrInfo(orderId, currentPageUrl) {
        const paymentData = await this.orderRepository.createQrPayment(orderId);
        return this.qrPaymentService.createQrInfo(paymentData, currentPageUrl, 220);
    }

    async getOrderPaymentState(orderId) {
        return this.orderRepository.getOrderPaymentState(orderId);
    }
}
