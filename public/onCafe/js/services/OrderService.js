// Kiểm tra quy tắc nghiệp vụ trước khi thực hiện thao tác đơn hàng.
const ALLOWED_STATUS = new Set([
    "confirmed",
    "preparing",
    "ready_for_pickup",
    "delivering",
    "completed",
    "rejected"
]);

export class OrderService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(orderRepository) {
        this.orderRepository = orderRepository;
    }

    // Lấy danh sách đơn hàng dành cho nhân viên.
    async getStaffOrders() {
        return await this.orderRepository.findAllForStaff();
    }

    // Gửi yêu cầu thay đổi trạng thái đơn hàng.
    async updateStatus(orderId, status) {
        if (!ALLOWED_STATUS.has(status)) {
            throw new Error("Trạng thái đơn hàng không hợp lệ.");
        }

        return await this.orderRepository.updateStatus(orderId, status);
    }

    // Ghi nhận đơn giao hàng đã đến nơi.
    async markDeliveryArrived(orderId) {
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Mã đơn hàng không hợp lệ.");
        return await this.orderRepository.markDeliveryArrived(id);
    }

    // Gửi yêu cầu tạo đơn tại quầy và chuẩn hóa kết quả.
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
        const createdOrder = await this.orderRepository.createCounterOrder(order);
        if (order.paymentMethod === "cash") {
            try {
                await this.updatePayment(createdOrder.id, "paid");
            } catch (error) {
                const paymentError = new Error(
                    `Đơn ${createdOrder.order_code || "#" + createdOrder.id} đã được tạo nhưng chưa ghi nhận thanh toán tiền mặt. Không tạo lại đơn; hãy cập nhật thanh toán trong mục Quản lý đơn hàng. ${error.message || ""}`
                );
                paymentError.orderCreated = createdOrder;
                throw paymentError;
            }
        }
        return createdOrder;
    }

    // Tạo yêu cầu xác nhận thanh toán QR.
    async createQrConfirmation(orderId) {
        return await this.orderRepository.createQrConfirmation(orderId);
    }

    // Cập nhật trạng thái thanh toán của đơn hàng.
    async updatePayment(orderId, paymentStatus) {
        if (!["paid", "unpaid"].includes(paymentStatus)) {
            throw new Error("Trạng thái thanh toán không hợp lệ.");
        }
        return await this.orderRepository.updatePayment(orderId, paymentStatus);
    }
}
