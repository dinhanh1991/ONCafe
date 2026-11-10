// Nối các thành phần thông báo nhân viên lại với nhau cho khu vực quản trị:
// kênh WebSocket theo vai trò (repository) → service (lọc trùng, đồng bộ dự phòng đơn hàng) → các view
// (chuông, thông báo nổi, âm báo). Loại thông báo nào gửi đến vai trò nào do cơ sở dữ liệu quyết định.
import { NOTIFICATION_CATEGORY, NOTIFICATION_TYPE } from "../../models/StaffNotification.js";
import { NotificationStateRepository } from "../../repositories/NotificationStateRepo.js";
import { StaffRealtimeRepository } from "../../repositories/StaffRealtimeRepo.js";
import { StaffNotificationService } from "../../services/StaffNotificationService.js";
import { NotificationBell } from "../../views/admin/notifications/NotificationBell.js";
import { NotificationToasts } from "../../views/admin/notifications/NotificationToasts.js";
import { NotificationSound } from "../../views/admin/notifications/NotificationSound.js";
import { BrowserNotifier } from "../../views/admin/notifications/BrowserNotifier.js";

const MAX_DETAILED_TOASTS = 3;
const MAX_HISTORY = 20;

// Đếm số thông báo theo nhóm để tạo câu tóm tắt khi có nhiều thông báo cùng lúc.
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

// Tạo bộ điều khiển thông báo nhân viên; trả về các hàm start, stop và markHandled.
// openSection(tênKhuVực) do nơi gọi cung cấp để mở trang quản trị (đã kiểm tra quyền truy cập).
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
            unread = 0;
            refresh();
        }
    }).mount(header);

    // Trình bày các thông báo mới: lưu lịch sử, hiện thông báo nổi, phát âm báo và báo ra ngoài trình duyệt nếu cần.
    function present(notifications) {
        history = [
            ...notifications.map(({ key, type, appearance, target, title, detail, at }) => (
                { key, type, appearance, target, title, detail, at }
            )),
            ...history
        ].slice(0, MAX_HISTORY);
        stateRepository.saveHistory(history);
        unread += notifications.length;
        refresh();

        // Nhiều thông báo cùng lúc thì gộp thành một để không che màn hình.
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
        role,
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
