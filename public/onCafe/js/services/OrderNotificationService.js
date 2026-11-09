// Điều phối thông báo đơn hàng: nhận sự kiện tức thời qua WebSocket, đồng bộ dự phòng khi mất kết nối,
// chống báo trùng và bỏ qua thao tác do chính tài khoản hiện tại thực hiện.
import {
    NOTIFICATION_TYPE,
    createNotificationKey,
    createOrderNotification
} from "../models/OrderNotification.js";
import { buildSnapshot, detectOrderChanges } from "./OrderChangeDetector.js";

export class OrderNotificationService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor({
        realtimeRepository,
        getOrders,
        stateRepository,
        currentUserId,
        onNotify,
        onConnectionChange = () => {},
        onError = (error) => console.error("Không thể xử lý thông báo đơn hàng:", error),
        fallbackIntervalMs = 15000,
        reconcileIntervalMs = 300000
    }) {
        if (typeof getOrders !== "function") throw new Error("OrderNotificationService cần hàm getOrders.");
        if (!realtimeRepository || !stateRepository) throw new Error("OrderNotificationService thiếu phụ thuộc.");

        this.realtimeRepository = realtimeRepository;
        this.getOrders = getOrders;
        this.stateRepository = stateRepository;
        this.currentUserId = currentUserId;
        this.onNotify = onNotify;
        this.onConnectionChange = onConnectionChange;
        this.onError = onError;
        this.fallbackIntervalMs = fallbackIntervalMs;
        this.reconcileIntervalMs = reconcileIntervalMs;

        this.timer = null;
        this.generation = 0;
        this.connected = false;
        this.syncing = false;
        this.resyncRequested = false;
        this.lastSyncAt = 0;
        this.handleVisibilityChange = () => {
            if (!document.hidden) void this.sync();
        };
    }

    // Bắt đầu nhận thông báo: mở kênh WebSocket và đồng bộ trạng thái hiện tại.
    async start() {
        this.stop();
        const generation = this.generation;

        this.timer = window.setInterval(() => this.tick(generation), this.fallbackIntervalMs);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        void this.sync(generation);

        try {
            await this.realtimeRepository.subscribe({
                onEvent: (payload) => this.handleRealtimeEvent(payload, generation),
                onStatusChange: (status) => this.handleStatus(status, generation)
            });
        } catch (error) {
            if (generation === this.generation) {
                this.setConnected(false);
                this.onError(error);
            }
        }
    }

    // Dừng nhận thông báo và dọn tài nguyên.
    stop() {
        this.generation += 1;
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        void this.realtimeRepository.unsubscribe?.();
        this.connected = false;
        this.syncing = false;
        this.resyncRequested = false;
    }

    // Ghi nhận thao tác do chính nhân viên này thực hiện để không tự báo cho mình.
    markHandled(type, orderId) {
        if (orderId === undefined || orderId === null || orderId === "") return;
        this.stateRepository.addSeen(createNotificationKey(type, orderId));
        this.updateSnapshotEntry(orderId, type === NOTIFICATION_TYPE.COMPLETED ? "completed" : "pending", type === NOTIFICATION_TYPE.NEW);
    }

    // Xử lý sự kiện nhận tức thời qua WebSocket.
    handleRealtimeEvent(payload, generation = this.generation) {
        if (generation !== this.generation) return;
        const notification = createOrderNotification(payload?.type, payload?.order, { actor: payload?.actor });
        if (!notification) return;
        this.updateSnapshotEntry(notification.orderId, notification.status || "", false);
        this.deliver([notification]);
    }

    // Xử lý thay đổi trạng thái kết nối của kênh.
    handleStatus(status, generation = this.generation) {
        if (generation !== this.generation) return;
        if (status === "SUBSCRIBED") {
            this.setConnected(true);
            // Bù các sự kiện có thể đã bỏ lỡ trong lúc chưa kết nối.
            void this.sync(generation);
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            this.setConnected(false);
        }
    }

    // Kiểm tra định kỳ: khi mất kết nối thì đồng bộ ngay, khi đang kết nối chỉ đối soát thưa.
    tick(generation) {
        if (generation !== this.generation) return;
        if (this.connected && Date.now() - this.lastSyncAt < this.reconcileIntervalMs) return;
        void this.sync(generation);
    }

    // Đồng bộ lại danh sách đơn, so với lần trước để tìm đơn mới và đơn vừa hoàn tất.
    async sync(generation = this.generation) {
        if (generation !== this.generation) return;
        if (this.syncing) {
            this.resyncRequested = true;
            return;
        }

        this.syncing = true;
        try {
            do {
                this.resyncRequested = false;
                const orders = await this.getOrders();
                if (generation !== this.generation || !Array.isArray(orders)) return;

                const previous = this.stateRepository.getSnapshot();
                this.stateRepository.saveSnapshot(buildSnapshot(orders));
                this.lastSyncAt = Date.now();
                // Lần đầu chỉ ghi nhận hiện trạng, không báo các đơn đã có sẵn.
                if (previous) this.deliver(detectOrderChanges(previous, orders));
            } while (this.resyncRequested && generation === this.generation);
        } catch (error) {
            if (generation === this.generation) this.onError(error);
        } finally {
            if (generation === this.generation) this.syncing = false;
        }
    }

    // Lọc trùng và thao tác của chính mình rồi chuyển các thông báo mới cho giao diện.
    deliver(notifications) {
        const fresh = [];
        for (const notification of notifications) {
            if (this.stateRepository.hasSeen(notification.key)) continue;
            this.stateRepository.addSeen(notification.key);
            if (notification.actor && notification.actor === this.currentUserId) continue;
            fresh.push(notification);
        }
        if (fresh.length) this.onNotify?.(fresh);
    }

    // Cập nhật một dòng trong ảnh chụp để lần đồng bộ sau không coi đây là thay đổi mới.
    updateSnapshotEntry(orderId, status, onlyIfMissing) {
        const snapshot = this.stateRepository.getSnapshot();
        if (!snapshot) return;
        const id = String(orderId);
        if (onlyIfMissing && Object.prototype.hasOwnProperty.call(snapshot, id)) return;
        snapshot[id] = status;
        this.stateRepository.saveSnapshot(snapshot);
    }

    // Cập nhật trạng thái kết nối và báo cho giao diện khi có thay đổi.
    setConnected(connected) {
        if (this.connected === connected) return;
        this.connected = connected;
        this.onConnectionChange(connected);
    }
}
