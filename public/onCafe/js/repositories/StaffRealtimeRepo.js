// Kết nối Supabase Realtime để nhận thông báo đã được lưu trong Database.
// Mỗi tài khoản chỉ đăng ký nhận các bản ghi có recipient_id trùng với user đang đăng nhập.
export class StaffRealtimeRepository {
    constructor({ client }) {
        if (!client) throw new Error("StaffRealtimeRepository cần client Supabase.");
        this.client = client;
        this.channel = null;
    }

    async subscribe({ userId, onEvent, onStatusChange }) {
        if (!userId) throw new Error("StaffRealtimeRepository cần mã tài khoản.");
        await this.unsubscribe();

        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;

        const token = data?.session?.access_token;
        if (token) this.client.realtime.setAuth(token);

        const channel = this.client
            .channel(`oncafe:notifications:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "staff_notifications",
                    filter: `recipient_id=eq.${userId}`
                },
                (change) => onEvent?.(change?.new)
            );

        channel.subscribe((status, error) => onStatusChange?.(status, error));
        this.channel = channel;
    }

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
