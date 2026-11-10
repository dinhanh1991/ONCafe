// Nối Database Realtime với chuông, thông báo nổi và âm báo của khu vực nhân viên.
import { createNotificationFromPayload, NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from "../../models/StaffNotification.js";
import { NotificationStateRepository } from "../../repositories/NotificationStateRepo.js";
import { StaffRealtimeRepository } from "../../repositories/StaffRealtimeRepo.js";
import { StaffNotificationService } from "../../services/StaffNotificationService.js";
import { NotificationBell } from "../../views/admin/notifications/NotificationBell.js";
import { NotificationToasts } from "../../views/admin/notifications/NotificationToasts.js";
import { NotificationSound } from "../../views/admin/notifications/NotificationSound.js";
import { BrowserNotifier } from "../../views/admin/notifications/BrowserNotifier.js";

const MAX_DETAILED_TOASTS = 3;
const MAX_HISTORY = 20;

function summarize(notifications) {
    const counts = { newOrders: 0, completedOrders: 0, menu: 0, team: 0 };
    for (const item of notifications) {
        if (item.category === NOTIFICATION_CATEGORY.ORDER) {
            if (item.type === NOTIFICATION_TYPE.COMPLETED) counts.completedOrders += 1;
            else counts.newOrders += 1;
        } else if (item.category === NOTIFICATION_CATEGORY.MENU) {
            counts.menu += 1;
        } else {
            counts.team += 1;
        }
    }

    const parts = [];
    if (counts.newOrders) parts.push(`${counts.newOrders} đơn mới`);
    if (counts.completedOrders) parts.push(`${counts.completedOrders} đơn hoàn tất`);
    if (counts.menu) parts.push(`${counts.menu} thay đổi đồ uống`);
    if (counts.team) parts.push(`${counts.team} nhân viên mới`);

    const targets = new Set(notifications.map((item) => item.target));
    return {
        type: "summary",
        appearance: counts.newOrders || !(counts.menu || counts.team) ? "new" : counts.menu ? "menu" : "team",
        target: targets.size === 1 ? [...targets][0] : null,
        title: "Có cập nhật mới",
        detail: parts.join(" · ")
    };
}

export function createStaffNotificationController({
    supabaseClient,
    getOrders,
    userId,
    role,
    openSection,
    header = document.querySelector(".site-header")
}) {
    const stateRepository = new NotificationStateRepository({ userId });
    const sound = new NotificationSound({ stateRepository });
    const openNotification = (notification) => {
        if (notification?.target) openSection?.(notification.target);
    };
    const browserNotifier = new BrowserNotifier({ onClick: () => openSection?.("orders") });
    const toasts = new NotificationToasts({ onOpen: openNotification }).mount();

    let history = stateRepository.getHistory();
    let unread = history.filter((item) => !item.isRead).length;
    let connected = false;

    function refresh() {
        bell.render({
            history,
            unread,
            soundEnabled: sound.enabled,
            permission: browserNotifier.permission,
            connected
        });
    }

    async function markAllRead() {
        try {
            const { error } = await supabaseClient
                .from("staff_notifications")
                .update({ is_read: true })
                .eq("recipient_id", userId)
                .eq("is_read", false);
            if (error) throw error;

            history = history.map((item) => ({ ...item, isRead: true }));
            stateRepository.saveHistory(history);
            unread = 0;
            refresh();
        } catch (error) {
            console.error("Không thể cập nhật trạng thái đã đọc:", error);
        }
    }

    const bell = new NotificationBell({
        onOpenNotification: openNotification,
        onToggleSound: () => {
            sound.setEnabled(!sound.enabled);
            if (sound.enabled) sound.play("new");
            refresh();
        },
        onRequestPermission: async () => {
            await browserNotifier.requestPermission();
            refresh();
        },
        onPanelOpened: () => {
            void markAllRead();
        }
    }).mount(header);

    function present(notifications) {
        const saved = notifications.map((item) => ({
            id: item.id,
            key: item.key,
            type: item.type,
            appearance: item.appearance,
            target: item.target,
            title: item.title,
            detail: item.detail,
            at: item.at,
            isRead: Boolean(item.isRead)
        }));

        history = [...saved, ...history].slice(0, MAX_HISTORY);
        stateRepository.saveHistory(history);
        unread += saved.filter((item) => !item.isRead).length;
        refresh();

        if (notifications.length > MAX_DETAILED_TOASTS) {
            toasts.show(summarize(notifications));
        } else {
            for (const item of notifications) toasts.show(item);
        }

        const hasNewOrder = notifications.some(
            (item) => item.category === NOTIFICATION_CATEGORY.ORDER && item.type === NOTIFICATION_TYPE.NEW
        );
        const hasCompletedOrder = notifications.some((item) => item.type === NOTIFICATION_TYPE.COMPLETED);
        sound.play(hasNewOrder ? "new" : hasCompletedOrder ? "completed" : "info");

        if (document.hidden) {
            const first = notifications[0];
            browserNotifier.show(
                notifications.length > 1 ? `Có ${notifications.length} thông báo mới` : first.title,
                notifications.length > 1 ? "Mở ONCafe để xem chi tiết." : first.detail,
                () => openNotification(notifications.length > 1 ? summarize(notifications) : first)
            );
        }
    }

    const service = new StaffNotificationService({
        realtimeRepository: new StaffRealtimeRepository({ client: supabaseClient }),
        getOrders,
        stateRepository,
        currentUserId: userId,
        userId,
        onNotify: present,
        onConnectionChange: (isConnected) => {
            connected = isConnected;
            refresh();
        }
    });

    refresh();

    return {
        start: async () => {
            // Kết nối Realtime trước, sau đó tải lịch sử để không bỏ lỡ sự kiện phát sinh đúng lúc mở trang.
            await service.start();

            try {
                const { data, error } = await supabaseClient
                    .from("staff_notifications")
                    .select("id, payload, is_read, created_at")
                    .eq("recipient_id", userId)
                    .order("created_at", { ascending: false })
                    .limit(MAX_HISTORY);

                if (error) throw error;

                const databaseHistory = data
                    .map((record) => {
                        const timestamp = Date.parse(record.created_at);
                        const item = createNotificationFromPayload(record.payload, {
                            at: Number.isFinite(timestamp) ? timestamp : Date.now()
                        });
                        if (!item) return null;
                        return {
                            ...item,
                            id: record.id,
                            isRead: Boolean(record.is_read)
                        };
                    })
                    .filter(Boolean);

                // Giữ cả sự kiện realtime vừa đến trong lúc truy vấn lịch sử.
                const databaseIds = new Set(databaseHistory.map((item) => item.id));
                history = [
                    ...databaseHistory,
                    ...history.filter((item) => !item.id || !databaseIds.has(item.id))
                ]
                    .sort((a, b) => b.at - a.at)
                    .slice(0, MAX_HISTORY);

                stateRepository.saveHistory(history);
                unread = history.filter((item) => !item.isRead).length;
                refresh();
            } catch (error) {
                console.error("Không thể tải lịch sử thông báo từ Database:", error);
            }
        },
        stop: () => service.stop(),
        markHandled: (type, orderId) => service.markHandled(type, orderId)
    };
}
