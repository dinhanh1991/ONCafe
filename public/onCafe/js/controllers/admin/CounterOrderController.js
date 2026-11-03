/**
 * CounterOrderController
 * Điều phối quy trình tạo đơn tại quầy và các bước sau khi tạo đơn.
 * Không thao tác DOM; View chịu trách nhiệm hiển thị kết quả.
 */
export class CounterOrderController {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor({ createOrder, refreshOrders, createQrConfirmation }) {
        this.createOrderAction = createOrder;
        this.refreshOrdersAction = refreshOrders;
        this.createQrConfirmationAction = createQrConfirmation;
    }

    // Tải lại danh sách đơn hàng mới nhất.
    async refreshOrders() {
        try {
            await this.refreshOrdersAction?.();
            return null;
        } catch (error) {
            console.error("Không thể tải lại danh sách đơn hàng:", error);
            return error;
        }
    }

    // Kiểm tra dữ liệu và gửi yêu cầu tạo đơn hàng.
    async createOrder(order) {
        let createdOrder;

        try {
            createdOrder = await this.createOrderAction(order);
        } catch (error) {
            if (!error.orderCreated) {
                throw error;
            }

            createdOrder = error.orderCreated;
            await this.refreshOrders();
            return {
                status: "payment-pending",
                order: createdOrder,
                error
            };
        }

        const refreshError = await this.refreshOrders();

        if (order.paymentMethod !== "qr") {
            return {
                status: "created",
                order: createdOrder,
                refreshError
            };
        }

        try {
            const qrConfirmation = await this.createQrConfirmationAction(createdOrder.id);
            return {
                status: "qr-ready",
                order: createdOrder,
                qrConfirmation,
                refreshError
            };
        } catch (error) {
            return {
                status: "qr-failed",
                order: createdOrder,
                error,
                refreshError
            };
        }
    }

    // Thử lại thao tác xác nhận thanh toán QR.
    async retryQrConfirmation(order) {
        if (!order?.id) {
            throw new Error("Không tìm thấy đơn hàng cần tạo lại mã QR.");
        }

        return await this.createQrConfirmationAction(order.id);
    }
}
