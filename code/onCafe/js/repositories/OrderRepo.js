import { supabase } from "../config/supabase.js";

export class OrderRepository {
    async findAllForStaff() {
        const { data, error } = await supabase.rpc("oncafe_staff_list_orders");
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Dữ liệu đơn hàng trả về không đúng định dạng.");
        return data;
    }

    async updateStatus(orderId, status) {
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Mã đơn hàng không hợp lệ.");
        const { error } = await supabase.rpc("oncafe_staff_update_order_status", {
            p_order_id: id,
            p_status: status
        });
        if (error) throw error;
    }

    async createCounterOrder(order) {
        const { data, error } = await supabase.rpc("oncafe_staff_create_order", {
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

    async updatePayment(orderId, paymentStatus) {
        const id = Number(orderId);
        if (!Number.isInteger(id) || id <= 0) throw new Error("Mã đơn hàng không hợp lệ.");
        if (!["paid", "unpaid"].includes(paymentStatus)) throw new Error("Trạng thái thanh toán không hợp lệ.");
        const { error } = await supabase.rpc("oncafe_staff_update_payment", {
            p_order_id: id,
            p_payment_status: paymentStatus
        });
        if (error) throw error;
    }
}
