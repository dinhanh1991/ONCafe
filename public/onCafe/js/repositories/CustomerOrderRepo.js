import { supabase } from "../config/supabase.js";

export class CustomerOrderRepository {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    // Lấy thông tin tài khoản đang đăng nhập.
    async getCurrentUser() {
        const { data, error } = await this.supabase.auth.getUser();
        if (error) throw error;
        return data.user;
    }

    // Lấy hồ sơ khách hàng theo mã tài khoản.
    async getCustomerProfile(userId) {
        const { data, error } = await this.supabase
            .from("profiles")
            .select("full_name, phone, address")
            .eq("id", userId)
            .maybeSingle();

        // Giữ hành vi cũ: không có hồ sơ thì vẫn cho khách tiếp tục tự nhập thông tin.
        if (error) return null;
        return data;
    }

    // Kiểm tra dữ liệu và gửi yêu cầu tạo đơn hàng.
    async createOrder({ fullName, phone, address, paymentMethod, fulfillmentMethod, items }) {
        const { data, error } = await this.supabase.rpc("oncafe_create_order", {
            p_full_name: fullName,
            p_phone: phone,
            p_address: address,
            p_payment_method: paymentMethod,
            p_fulfillment_method: fulfillmentMethod,
            p_items: items
        });

        if (error) throw error;
        return Array.isArray(data) ? data[0] : data;
    }

    // Tạo thông tin yêu cầu thanh toán QR.
    async createQrPayment(orderId) {
        const { data, error } = await this.supabase.functions.invoke("oncafe-qr-payment", {
            body: { action: "create", order_id: orderId }
        });

        if (error) throw new Error(data?.error || error.message || "Không tạo được mã QR.");
        if (!data?.token) throw new Error(data?.error || "Không nhận được mã QR.");
        return data;
    }

    // Lấy danh sách đơn hàng của khách hàng đang đăng nhập.
    async getMyOrders() {
        const { data, error } = await this.supabase.rpc("oncafe_my_orders");
        if (error) throw error;
        return Array.isArray(data) ? data : [];
    }

    // Lấy trạng thái thanh toán của đơn hàng.
    async getOrderPaymentState(orderId) {
        const { data, error } = await this.supabase.rpc("oncafe_my_order_payment_state", {
            p_order_id: orderId
        });

        if (error) throw error;
        return data || null;
    }

    // Gửi yêu cầu hủy đơn hàng của khách.
    async cancelMyOrder(orderId) {
        const { error } = await this.supabase.rpc("oncafe_cancel_my_order", {
            p_order_id: orderId
        });

        if (error) throw error;
    }
}
