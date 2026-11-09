// Nhận broadcast sản phẩm và nhân viên qua các kênh private có RLS phân quyền ở database.
export const STAFF_PRODUCT_TOPIC = "oncafe:staff-products";
export const STAFF_EMPLOYEE_TOPIC = "oncafe:staff-orders";
const PRODUCT_EVENTS = ["product_created", "product_updated", "product_deleted"];
const EMPLOYEE_EVENTS = ["employee_created"];

export class StaffActivityRealtimeRepository {
    constructor({ client }) {
        if (!client) throw new Error("StaffActivityRealtimeRepository cần client Supabase.");
        this.client = client;
        this.channels = [];
    }

    async subscribe({ onEvent, onStatusChange }) {
        await this.unsubscribe();
        const { data, error } = await this.client.auth.getSession();
        if (error) throw error;
        const token = data?.session?.access_token;
        if (!token) throw new Error("Không tìm thấy phiên đăng nhập để nhận thông báo.");
        this.client.realtime.setAuth(token);

        const subscribeTopic = (topic, events) => {
            const channel = this.client.channel(topic, { config: { private: true } });
            for (const event of events) {
                channel.on("broadcast", { event }, (message) => onEvent?.(message?.payload));
            }
            channel.subscribe((status, error) => onStatusChange?.(status, error));
            this.channels.push(channel);
        };

        subscribeTopic(STAFF_PRODUCT_TOPIC, PRODUCT_EVENTS);
        subscribeTopic(STAFF_EMPLOYEE_TOPIC, EMPLOYEE_EVENTS);
    }

    async unsubscribe() {
        const channels = this.channels.splice(0);
        await Promise.all(channels.map(async (channel) => {
            try {
                await this.client.removeChannel(channel);
            } catch (error) {
                console.error("Không thể đóng kênh thông báo hoạt động:", error);
            }
        }));
    }
}
