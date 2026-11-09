// Bộ điều khiển thông báo đơn hàng, sản phẩm và nhân viên.
import { NotificationStateRepository } from "../../repositories/NotificationStateRepo.js";
import { OrderRealtimeRepository } from "../../repositories/OrderRealtimeRepo.js";
import { StaffActivityRealtimeRepository } from "../../repositories/StaffActivityRealtimeRepo.js";
import { OrderNotificationService } from "../../services/OrderNotificationService.js";
import { StaffActivityNotificationService } from "../../services/StaffActivityNotificationService.js";
import { NotificationBell } from "../../views/admin/notifications/NotificationBell.js";
import { NotificationToasts } from "../../views/admin/notifications/NotificationToasts.js";
import { NotificationSound } from "../../views/admin/notifications/NotificationSound.js";
import { BrowserNotifier } from "../../views/admin/notifications/BrowserNotifier.js";

const MAX_DETAILED_TOASTS = 3;

export function createOrderNotificationController({
    supabaseClient, getOrders, userId, role, openOrdersPage, openProductsPage = openOrdersPage,
    openEmployeesPage = openOrdersPage, header = document.querySelector(".site-header")
}) {
    const stateRepository = new NotificationStateRepository({ userId });
    const sound = new NotificationSound({ stateRepository });
    let lastNotification = null;
    const openNotification = (item = lastNotification) => {
        if (item?.category === "products") return openProductsPage?.();
        if (item?.category === "employees") return openEmployeesPage?.();
        return openOrdersPage?.();
    };
    const browserNotifier = new BrowserNotifier({ onClick: () => openNotification() });
    const toasts = new NotificationToasts({ onOpen: (item) => openNotification(item) }).mount();
    let history = stateRepository.getHistory();
    let unread = 0;
    let connected = false;

    function refresh() {
        bell.render({ history, unread, soundEnabled: sound.enabled, permission: browserNotifier.permission, connected });
    }

    const bell = new NotificationBell({
        onOpenNotification: (item) => openNotification(item),
        onToggleSound: () => {
            sound.setEnabled(!sound.enabled);
            if (sound.enabled) sound.play("new");
            refresh();
        },
        onRequestPermission: async () => {
            await browserNotifier.requestPermission();
            refresh();
        },
        onPanelOpened: () => { unread = 0; refresh(); }
    }).mount(header);

    function present(notifications) {
        if (!notifications.length) return;
        lastNotification = notifications[notifications.length - 1];
        history = [
            ...notifications.map(({ key, type, category = "orders", title, detail, at }) => ({ key, type, category, title, detail, at })),
            ...history
        ].slice(0, 20);
        stateRepository.saveHistory(history);
        unread += notifications.length;
        refresh();

        if (notifications.length > MAX_DETAILED_TOASTS) {
            const categories = new Set(notifications.map((item) => item.category || "orders"));
            toasts.show({
                type: "summary",
                category: categories.size === 1 ? [...categories][0] : "orders",
                title: "ONCafe có cập nhật mới",
                detail: `${notifications.length} thông báo mới. Mở chuông để xem chi tiết.`
            });
        } else {
            for (const item of notifications) toasts.show(item);
        }

        sound.play("new");
        if (document.hidden) {
            browserNotifier.show(
                notifications.length > 1 ? `Có ${notifications.length} cập nhật mới` : notifications[0].title,
                notifications.length > 1 ? "Mở ONCafe để xem chi tiết." : notifications[0].detail
            );
        }
    }

    const orderService = new OrderNotificationService({
        realtimeRepository: new OrderRealtimeRepository({ client: supabaseClient }),
        getOrders, stateRepository, currentUserId: userId,
        onNotify: present,
        onConnectionChange: (isConnected) => { connected = isConnected; refresh(); }
    });
    const activityService = new StaffActivityNotificationService({
        realtimeRepository: new StaffActivityRealtimeRepository({ client: supabaseClient }),
        stateRepository, includeProducts: role === "admin" || role === "seller", onNotify: present,
        onError: (error) => console.error("Không thể nhận thông báo sản phẩm/nhân viên:", error)
    });

    refresh();
    return {
        start: async () => { await Promise.all([orderService.start(), activityService.start()]); },
        stop: () => { orderService.stop(); activityService.stop(); },
        markHandled: (type, orderId) => orderService.markHandled(type, orderId)
    };
}
