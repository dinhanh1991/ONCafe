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
}