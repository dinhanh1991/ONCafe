// Giao tiếp với cơ sở dữ liệu cho nghiệp vụ đơn hàng quản trị.
import { supabase } from "../config/supabase.js";

export class OrderRepository {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    // Tải danh sách đơn hàng mà nhân viên được phép xem.
    async findAllForStaff() {
        const { data, error } = await this.supabase.rpc("oncafe_staff_list_orders");
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Dữ liệu đơn hàng trả về không đúng định dạng.");
        return data;
    }

    // Ghi nhận đơn giao hàng đã đến nơi.
    async markDeliveryArrived(orderId) {
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Mã đơn hàng không hợp lệ.");
        const { data, error } = await this.supabase.rpc("oncafe_staff_mark_delivery_arrived", {
            p_order_id: id
        });
        if (error) throw error;
        return data;
    }

    // Gửi yêu cầu thay đổi trạng thái đơn hàng.
    async updateStatus(orderId, status) {
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Mã đơn hàng không hợp lệ.");
        const { error } = await this.supabase.rpc("oncafe_staff_update_order_status", {
            p_order_id: id,
            p_status: status
        });
        if (error) throw error;
    }

    // Gửi yêu cầu tạo đơn tại quầy và chuẩn hóa kết quả.
    async createCounterOrder(order) {
        const { data, error } = await this.supabase.rpc("oncafe_staff_create_order", {
            p_customer_name: order.customerName,
            p_customer_phone: order.customerPhone || "",
            p_customer_address: order.customerAddress || "",
            p_payment_method: order.paymentMethod,
            p_items: order.items
        });
        if (error) throw error;

        const result = Array.isArray(data) ? data[0] : data;
        if (!result) {
            throw new Error("Đơn hàng đã gửi nhưng không nhận được thông tin xác nhận.");
        }

        return {
            id: result.order_id,
            order_code: result.order_code,
            total_amount: result.total_amount
        };
    }

    // Tạo yêu cầu xác nhận thanh toán QR.
    async createQrConfirmation(orderId) {
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Mã đơn hàng không hợp lệ.");
        const { data, error } = await this.supabase.functions.invoke("oncafe-qr-payment", {
            body: { action: "create", order_id: id }
        });
        if (error) throw error;
        if (!data?.token) throw new Error(data?.error || "Không tạo được mã QR xác nhận.");
        return data;
    }

    // Cập nhật trạng thái thanh toán của đơn hàng.
    async updatePayment(orderId, paymentStatus) {
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Mã đơn hàng không hợp lệ.");
        if (!["paid", "unpaid"].includes(paymentStatus)) throw new Error("Trạng thái thanh toán không hợp lệ.");
        const { error } = await this.supabase.rpc("oncafe_staff_update_payment", {
            p_order_id: id,
            p_payment_status: paymentStatus
        });
        if (error) throw error;
    }
}
