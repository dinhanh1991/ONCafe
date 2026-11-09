// Nối các thành phần thông báo đơn hàng lại với nhau cho khu vực quản trị:
// kênh WebSocket (repository) → service (lọc trùng, đồng bộ dự phòng) → các view (chuông, thông báo nổi, âm báo).
import { NotificationStateRepository } from "../../repositories/NotificationStateRepo.js";
import { OrderRealtimeRepository } from "../../repositories/OrderRealtimeRepo.js";
import { OrderNotificationService } from "../../services/OrderNotificationService.js";
import { NotificationBell } from "../../views/admin/notifications/NotificationBell.js";
import { NotificationToasts } from "../../views/admin/notifications/NotificationToasts.js";
import { NotificationSound } from "../../views/admin/notifications/NotificationSound.js";
import { BrowserNotifier } from "../../views/admin/notifications/BrowserNotifier.js";

const MAX_DETAILED_TOASTS = 3;

// Tạo bộ điều khiển thông báo đơn hàng; trả về các hàm start, stop và markHandled.
export function createOrderNotificationController({
    supabaseClient,
    getOrders,
    userId,
    openOrdersPage,
    header = document.querySelector(".site-header")
}) {
    const stateRepository = new NotificationStateRepository({ userId });
    const sound = new NotificationSound({ stateRepository });
    const browserNotifier = new BrowserNotifier({ onClick: openOrdersPage });
    const toasts = new NotificationToasts({ onOpen: openOrdersPage }).mount();

    let history = stateRepository.getHistory();
    let unread = 0;
    let connected = false;

    // Vẽ lại chuông theo trạng thái hiện tại.
    function refresh() {
        bell.render({
            history,
            unread,
            soundEnabled: sound.enabled,
            permission: browserNotifier.permission,
            connected
        });
    }

    const bell = new NotificationBell({
        onOpenOrders: openOrdersPage,
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
            unread = 0;
            refresh();
        }
    }).mount(header);

    // Trình bày các thông báo mới: lưu lịch sử, hiện thông báo nổi, phát âm báo và báo ra ngoài trình duyệt nếu cần.
    function present(notifications) {
        history = [
            ...notifications.map(({ key, type, title, detail, at }) => ({ key, type, title, detail, at })),
            ...history
        ].slice(0, 20);
        stateRepository.saveHistory(history);
        unread += notifications.length;
        refresh();

        // Nhiều sự kiện cùng lúc thì gộp thành một thông báo để không che màn hình.
        if (notifications.length > MAX_DETAILED_TOASTS) {
            const newCount = notifications.filter((item) => item.type === "new").length;
            const completedCount = notifications.length - newCount;
            const parts = [];
            if (newCount) parts.push(`${newCount} đơn mới`);
            if (completedCount) parts.push(`${completedCount} đơn hoàn tất`);
            toasts.show({ type: newCount ? "new" : "completed", title: "Có cập nhật đơn hàng", detail: parts.join(" · ") });
        } else {
            for (const item of notifications) toasts.show(item);
        }

        sound.play(notifications.some((item) => item.type === "new") ? "new" : "completed");
        if (document.hidden) {
            browserNotifier.show(
                notifications.length > 1 ? `Có ${notifications.length} cập nhật đơn hàng` : notifications[0].title,
                notifications.length > 1 ? "Mở ONCafe để xem chi tiết." : notifications[0].detail
            );
        }
    }

    const service = new OrderNotificationService({
        realtimeRepository: new OrderRealtimeRepository({ client: supabaseClient }),
        getOrders,
        stateRepository,
        currentUserId: userId,
        onNotify: present,
        onConnectionChange: (isConnected) => {
            connected = isConnected;
            refresh();
        }
    });

    refresh();
    return {
        start: () => service.start(),
        stop: () => service.stop(),
        markHandled: (type, orderId) => service.markHandled(type, orderId)
    };
}
