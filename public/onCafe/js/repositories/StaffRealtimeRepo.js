// Kết nối WebSocket (Supabase Realtime) để nhận sự kiện do trigger trong cơ sở dữ liệu phát ra.
// Mỗi vai trò nghe một kênh riêng "oncafe:role:<vai trò>"; máy chủ chỉ cho tài khoản đúng vai trò nghe
// (chính sách RLS trong migration 20261109170000_role_based_staff_notifications.sql) và quyết định
// vai trò nào nhận loại thông báo nào, nên phía trình duyệt nhận mọi sự kiện trên kênh của mình.
export const STAFF_ROLES = Object.freeze(["admin", "seller", "cashier"]);

// Tên kênh của một vai trò nhân viên.
export function staffTopicFor(role) {
    if (!STAFF_ROLES.includes(role)) throw new Error("Vai trò không có kênh thông báo nhân viên.");
    return `oncafe:role:${role}`;
}

export class StaffRealtimeRepository {
    // Khởi tạo đối tượng; client Supabase được truyền vào để dễ thay thế khi kiểm thử.
    constructor({ client }) {
        if (!client) throw new Error("StaffRealtimeRepository cần client Supabase.");
        this.client = client;
        this.channel = null;
    }

    // Đăng ký nghe kênh của vai trò; onEvent nhận payload của từng sự kiện, onStatusChange nhận trạng thái kết nối.
    async subscribe({ role, onEvent, onStatusChange }) {
        const topic = staffTopicFor(role);
        await this.unsubscribe();

        // Kênh riêng cần mã phiên đăng nhập để máy chủ kiểm tra quyền.
        const { data } = await this.client.auth.getSession();
        const token = data?.session?.access_token;
        if (token) this.client.realtime.setAuth(token);

        const channel = this.client.channel(topic, { config: { private: true } });
        // Dấu * nhận mọi tên sự kiện: thêm loại thông báo mới chỉ cần sửa phía cơ sở dữ liệu và mô hình thông báo.
        channel.on("broadcast", { event: "*" }, (message) => onEvent?.(message?.payload));
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
            console.error("Không thể đóng kênh thông báo nhân viên:", error);
        }
    }
}
