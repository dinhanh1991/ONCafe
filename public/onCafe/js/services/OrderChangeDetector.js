// So sánh danh sách đơn hàng hiện tại với lần trước để tìm đơn mới và đơn vừa hoàn tất.
// Dùng khi đồng bộ lại (mở trang, kết nối lại, kiểm tra dự phòng); các hàm đều thuần, không đụng đến DOM hay mạng.
import { NOTIFICATION_TYPE, createOrderNotification } from "../models/OrderNotification.js";

// Tạo ảnh chụp gọn từ danh sách đơn: mã đơn → trạng thái.
export function buildSnapshot(orders) {
    const snapshot = {};
    for (const order of Array.isArray(orders) ? orders : []) {
        if (order?.id === undefined || order?.id === null) continue;
        snapshot[String(order.id)] = order.status || "";
    }
    return snapshot;
}

// Tìm các thay đổi đáng báo giữa ảnh chụp trước và danh sách đơn hiện tại.
export function detectOrderChanges(previous, orders, now = Date.now()) {
    const notifications = [];
    for (const order of Array.isArray(orders) ? orders : []) {
        if (order?.id === undefined || order?.id === null) continue;
        const id = String(order.id);
        const known = Object.prototype.hasOwnProperty.call(previous, id);

        let notification = null;
        if (!known) {
            notification = createOrderNotification(NOTIFICATION_TYPE.NEW, order, { at: now });
        } else if (previous[id] !== "completed" && order.status === "completed") {
            notification = createOrderNotification(NOTIFICATION_TYPE.COMPLETED, order, { at: now });
        }
        if (notification) notifications.push(notification);
    }
    return notifications;
}
