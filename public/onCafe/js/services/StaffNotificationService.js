// Điều phối thông báo nhân viên: nhận sự kiện từ Database Realtime, đồng bộ dự phòng đơn hàng,
// chống báo trùng và bỏ qua thao tác do chính tài khoản hiện tại thực hiện.
import {
    NOTIFICATION_CATEGORY,
    NOTIFICATION_TYPE,
    createNotificationFromPayload,
    createNotificationKey
} from "../models/StaffNotification.js";
import { buildSnapshot, detectOrderChanges } from "./OrderChangeDetector.js";

export class StaffNotificationService {
    constructor({
        realtimeRepository,
        getOrders,
        stateRepository,
        currentUserId,
        userId,
        onNotify,
        onConnectionChange = () => {},
        onError = (error) => console.error("Không thể xử lý thông báo nhân viên:", error),
        fallbackIntervalMs = 15000,
        reconcileIntervalMs = 300000
    }) {
        if (typeof getOrders !== "function") throw new Error("StaffNotificationService cần hàm getOrders.");
        if (!realtimeRepository || !stateRepository) throw new Error("StaffNotificationService thiếu phụ thuộc.");
        if (!userId) throw new Error("StaffNotificationService cần mã tài khoản.");

        this.realtimeRepository = realtimeRepository;
        this.getOrders = getOrders;
        this.stateRepository = stateRepository;
        this.currentUserId = currentUserId;
        this.userId = userId;
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
        this.lastReportedStatus = null;
        this.handleVisibilityChange = () => {
            if (!document.hidden) void this.sync();
        };
    }

    async start() {
        this.stop();
        const generation = this.generation;

        this.timer = window.setInterval(() => this.tick(generation), this.fallbackIntervalMs);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        void this.sync(generation);

        try {
            await this.realtimeRepository.subscribe({
                userId: this.userId,
                onEvent: (record) => this.handleRealtimeEvent(record, generation),
                onStatusChange: (status, error) => this.handleStatus(status, generation, error)
            });
        } catch (error) {
            if (generation === this.generation) {
                this.setConnected(false);
                this.onError(error);
            }
        }
    }

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

    markHandled(type, orderId) {
        if (orderId === undefined || orderId === null || orderId === "") return;
        this.stateRepository.addSeen(createNotificationKey(type, orderId));
        this.updateSnapshotEntry(orderId, type === NOTIFICATION_TYPE.COMPLETED ? "completed" : "pending", type === NOTIFICATION_TYPE.NEW);
    }

    // Bản ghi Realtime đã có payload, id và thời gian lưu trong Database.
    handleRealtimeEvent(record, generation = this.generation) {
        if (generation !== this.generation || !record?.payload) return;
        const timestamp = Date.parse(record.created_at);
        const notification = createNotificationFromPayload(record.payload, {
            at: Number.isFinite(timestamp) ? timestamp : Date.now()
        });
        if (!notification) return;

        notification.id = record.id;
        notification.isRead = Boolean(record.is_read);

        if (notification.category === NOTIFICATION_CATEGORY.ORDER) {
            this.updateSnapshotEntry(notification.orderId, notification.status || "", false);
        }
        this.deliver([notification]);
    }

    handleStatus(status, generation = this.generation, error = null) {
        if (generation !== this.generation) return;
        if (status === "SUBSCRIBED") {
            this.lastReportedStatus = null;
            this.setConnected(true);
            void this.sync(generation);
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            this.setConnected(false);
            if (this.lastReportedStatus !== status) {
                this.lastReportedStatus = status;
                const reason = error?.message ? `: ${error.message}` : "";
                this.onError(new Error(`Kênh thông báo nhân viên chưa kết nối (${status})${reason}`));
            }
        }
    }

    tick(generation) {
        if (generation !== this.generation) return;
        if (this.connected && Date.now() - this.lastSyncAt < this.reconcileIntervalMs) return;
        void this.sync(generation);
    }

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
                if (previous) this.deliver(detectOrderChanges(previous, orders));
            } while (this.resyncRequested && generation === this.generation);
        } catch (error) {
            if (generation === this.generation) this.onError(error);
        } finally {
            if (generation === this.generation) this.syncing = false;
        }
    }

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

    updateSnapshotEntry(orderId, status, onlyIfMissing) {
        const snapshot = this.stateRepository.getSnapshot();
        if (!snapshot) return;
        const id = String(orderId);
        if (onlyIfMissing && Object.prototype.hasOwnProperty.call(snapshot, id)) return;
        snapshot[id] = status;
        this.stateRepository.saveSnapshot(snapshot);
    }

    setConnected(connected) {
        if (this.connected === connected) return;
        this.connected = connected;
        this.onConnectionChange(connected);
    }
}
