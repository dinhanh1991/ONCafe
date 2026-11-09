// Mô hình thông báo đơn hàng dành cho nhân viên: loại thông báo, khóa chống trùng và nội dung hiển thị.
import { formatCurrency } from "../utils/FormatUtils.js";

export const NOTIFICATION_TYPE = Object.freeze({
    NEW: "new",
    COMPLETED: "completed"
});

const VALID_TYPES = new Set(Object.values(NOTIFICATION_TYPE));

// Tạo khóa duy nhất cho một sự kiện (mỗi đơn chỉ được báo một lần cho mỗi loại).
export function createNotificationKey(type, orderId) {
    return `${type}:${orderId}`;
}

// Tạo thông báo từ dữ liệu đơn hàng; trả về null nếu loại thông báo hoặc đơn hàng không hợp lệ.
export function createOrderNotification(type, order, { actor = null, at = Date.now() } = {}) {
    if (!VALID_TYPES.has(type)) return null;
    if (order?.id === undefined || order?.id === null || order?.id === "") return null;

    const code = order.order_code || `#${order.id}`;
    const customer = order.customer_name || "Khách hàng";
    const total = formatCurrency(order.total_amount);

    let title;
    let detail;
    if (type === NOTIFICATION_TYPE.COMPLETED) {
        title = `Đơn ${code} đã hoàn tất`;
        detail = `${customer} · ${total}`;
    } else {
        const isOnline = order.order_source === "online";
        const fulfillment = isOnline
            ? (order.fulfillment_method === "delivery" ? "Giao tận nhà" : "Nhận tại cửa hàng")
            : "";
        title = `Đơn mới ${code}`;
        detail = [isOnline ? "Đơn online" : "Đơn tại quầy", fulfillment, customer, total]
            .filter(Boolean)
            .join(" · ");
    }

    return {
        key: createNotificationKey(type, order.id),
        type,
        orderId: String(order.id),
        status: order.status || "",
        actor: actor || null,
        at,
        title,
        detail
    };
}
