// Điều phối thông báo hoạt động sản phẩm/nhân viên, chống trùng và giữ thông báo do chính Admin tạo.
import { createStaffActivityNotification } from "../models/StaffActivityNotification.js";

export class StaffActivityNotificationService {
    constructor({ realtimeRepository, stateRepository, onNotify, onConnectionChange = () => {}, onError = (error) => console.error("Lỗi thông báo hoạt động:", error) }) {
        this.realtimeRepository = realtimeRepository;
        this.stateRepository = stateRepository;
        this.onNotify = onNotify;
        this.onConnectionChange = onConnectionChange;
        this.onError = onError;
        this.generation = 0;
        this.connectedChannels = new Set();
    }

    async start() {
        this.stop();
        const generation = this.generation;
        try {
            await this.realtimeRepository.subscribe({
                onEvent: (payload) => this.handleEvent(payload, generation),
                onStatusChange: (status, error) => {
                    if (generation !== this.generation) return;
                    if (status === "SUBSCRIBED") this.connectedChannels.add("connected");
                    if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) this.connectedChannels.clear();
                    this.onConnectionChange(this.connectedChannels.size > 0);
                    if (error) this.onError(error);
                }
            });
        } catch (error) {
            if (generation === this.generation) this.onError(error);
        }
    }

    stop() {
        this.generation += 1;
        this.connectedChannels.clear();
        void this.realtimeRepository.unsubscribe();
        this.onConnectionChange(false);
    }

    handleEvent(payload, generation = this.generation) {
        if (generation !== this.generation) return;
        const notification = createStaffActivityNotification(payload);
        if (!notification || this.stateRepository.hasSeen(notification.key)) return;
        this.stateRepository.addSeen(notification.key);
        this.onNotify?.([notification]);
    }
}
