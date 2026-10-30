const ALLOWED_STATUS = new Set([
    "confirmed",
    "preparing",
    "ready_for_pickup",
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

    async markDeliveryArrived(orderId) {
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Mã đơn hàng không hợp lệ.");
        return await this.orderRepository.markDeliveryArrived(id);
    }

    async createCounterOrder(order) {
        if (!order || !Array.isArray(order.items) || order.items.length === 0) {
            throw new Error("Vui lòng chọn ít nhất một đồ uống.");
        }
        if (!String(order.customerName || "").trim()) {
            throw new Error("Vui lòng nhập tên khách hàng.");
        }
        if (!["cash", "qr"].includes(order.paymentMethod)) {
            throw new Error("Phương thức thanh toán không hợp lệ.");
        }
        return await this.orderRepository.createCounterOrder(order);
    }

    async createQrConfirmation(orderId) {
        return await this.orderRepository.createQrConfirmation(orderId);
    }

    async updatePayment(orderId, paymentStatus) {
        if (!["paid", "unpaid"].includes(paymentStatus)) {
            throw new Error("Trạng thái thanh toán không hợp lệ.");
        }
        return await this.orderRepository.updatePayment(orderId, paymentStatus);
    }
}
