const ALLOWED_STATUS = new Set([
    "confirmed",
    "preparing",
    "delivering",
    "completed",
    "rejected"
]);

export class OrderService {
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
    }

    async getStaffOrders() {
        return await this.orderRepository.findAllForStaff();
    }

    async updateStatus(orderId, status) {
        if (!ALLOWED_STATUS.has(status)) {
            throw new Error("Trạng thái đơn hàng không hợp lệ.");
        }

        return await this.orderRepository.updateStatus(orderId, status);
    }
}
