export class CustomerMyOrdersService {
    constructor(orderRepository) {
        if (!orderRepository) throw new Error("CustomerMyOrdersService cần CustomerOrderRepository.");
        this.orderRepository = orderRepository;
    }

    async getCurrentUser() {
        return this.orderRepository.getCurrentUser();
    }

    async getMyOrders() {
        return this.orderRepository.getMyOrders();
    }

    async createQrPayment(orderId) {
        return this.orderRepository.createQrPayment(orderId);
    }

    async cancelMyOrder(orderId) {
        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            throw new Error("Mã đơn hàng không hợp lệ.");
        }
        return this.orderRepository.cancelMyOrder(orderId);
    }
}
