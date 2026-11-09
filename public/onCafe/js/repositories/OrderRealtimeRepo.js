// Kết nối WebSocket (Supabase Realtime) để nhận sự kiện đơn hàng do trigger trong cơ sở dữ liệu phát ra.
// Kênh là kênh riêng (private): máy chủ chỉ cho tài khoản nhân viên nghe, theo chính sách RLS trong migration
// 20261109110000_staff_order_realtime_notifications.sql.
export const STAFF_ORDER_TOPIC = "oncafe:staff-orders";
export const ORDER_EVENTS = Object.freeze(["order_new", "order_completed"]);

export class OrderRealtimeRepository {
    // Khởi tạo đối tượng; client Supabase được truyền vào để dễ thay thế khi kiểm thử.
    constructor({ client }) {
        if (!client) throw new Error("OrderRealtimeRepository cần client Supabase.");
        this.client = client;
        this.channel = null;
    }

    // Đăng ký nghe kênh; onEvent nhận payload của từng sự kiện, onStatusChange nhận trạng thái kết nối.
    async subscribe({ onEvent, onStatusChange }) {
        await this.unsubscribe();

        // Kênh riêng cần mã phiên đăng nhập để máy chủ kiểm tra quyền.
        const { data } = await this.client.auth.getSession();
        const token = data?.session?.access_token;
        if (token) this.client.realtime.setAuth(token);

        const channel = this.client.channel(STAFF_ORDER_TOPIC, { config: { private: true } });
        for (const event of ORDER_EVENTS) {
            channel.on("broadcast", { event }, (message) => onEvent?.(message?.payload));
        }
        channel.subscribe((status, error) => onStatusChange?.(status, error));
        this.channel = channel;
    }

    // Hủy đăng ký và đóng kênh.
    async unsubscribe() {
        const channel = this.channel;
        this.channel = null;
        if (!channel) return;
        try {
            await this.client.removeChannel(channel);
        } catch (error) {
            console.error("Không thể đóng kênh thông báo đơn hàng:", error);
        }
    }
}
