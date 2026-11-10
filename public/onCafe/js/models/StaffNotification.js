// Mô hình thông báo dành cho nhân viên: loại thông báo, khóa chống trùng và nội dung hiển thị.
// Có ba nhóm: đơn hàng, đồ uống (thêm/sửa/xóa) và nhân viên mới tham gia.
import { formatCurrency } from "../utils/FormatUtils.js";

export const NOTIFICATION_TYPE = Object.freeze({
    NEW: "new",
    COMPLETED: "completed",
    MENU_CREATED: "menu_created",
    MENU_UPDATED: "menu_updated",
    MENU_DELETED: "menu_deleted",
    EMPLOYEE_JOINED: "employee_joined"
});

export const NOTIFICATION_CATEGORY = Object.freeze({
    ORDER: "order",
    MENU: "menu",
    TEAM: "team"
});

const ROLE_LABELS = {
    admin: "Quản trị viên",
    seller: "Nhân viên bán hàng",
    cashier: "Thu ngân"
};

const CHANGE_LABELS = {
    name: "tên",
    price: "giá",
    description: "mô tả",
    image: "ảnh",
    category: "danh mục",
    status: "trạng thái bán"
};

// Tạo khóa duy nhất cho một sự kiện đơn hàng (mỗi đơn chỉ được báo một lần cho mỗi loại).
export function createNotificationKey(type, orderId) {
    return `${type}:${orderId}`;
}

// Tạo khóa cho sự kiện không gắn với đơn hàng; mỗi lần sửa đồ uống là một sự kiện riêng.
function createEventKey(type, eventId, at) {
    return `${type}:${eventId || `${at}-${Math.random().toString(36).slice(2, 8)}`}`;
}

// Ghép tên và vai trò của người thực hiện thao tác; trả về chuỗi rỗng nếu không rõ.
function describeActor(payload) {
    const name = typeof payload?.actor_name === "string" ? payload.actor_name.trim() : "";
    if (!name) return "";
    const role = ROLE_LABELS[payload.actor_role];
    return role ? `${name} (${role})` : name;
}

// Tạo thông báo đơn hàng; trả về null nếu loại thông báo hoặc đơn hàng không hợp lệ.
export function createOrderNotification(type, order, { actor = null, at = Date.now() } = {}) {
    if (type !== NOTIFICATION_TYPE.NEW && type !== NOTIFICATION_TYPE.COMPLETED) return null;
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
        category: NOTIFICATION_CATEGORY.ORDER,
        appearance: type === NOTIFICATION_TYPE.COMPLETED ? "completed" : "new",
        target: "orders",
        orderId: String(order.id),
        status: order.status || "",
        actor: actor || null,
        at,
        title,
        detail
    };
}

// Tạo thông báo thêm, sửa hoặc xóa đồ uống.
function createMenuNotification(payload, at) {
    const name = typeof payload.product?.name === "string" ? payload.product.name.trim() : "";
    if (!payload.product || !name) return null;

    const actorText = describeActor(payload) || "hệ thống";
    let title;
    let detail = `Bởi ${actorText}`;
    if (payload.type === NOTIFICATION_TYPE.MENU_CREATED) {
        title = `Đã thêm đồ uống: ${name}`;
    } else if (payload.type === NOTIFICATION_TYPE.MENU_DELETED) {
        title = `Đã xóa đồ uống: ${name}`;
    } else {
        title = `Đã sửa đồ uống: ${name}`;
        const changed = (Array.isArray(payload.changed) ? payload.changed : [])
            .map((field) => CHANGE_LABELS[field])
            .filter(Boolean);
        if (changed.length) detail += ` · Đã đổi: ${changed.join(", ")}`;
    }

    return {
        key: createEventKey(payload.type, payload.event_id, at),
        type: payload.type,
        category: NOTIFICATION_CATEGORY.MENU,
        appearance: "menu",
        target: "drinks",
        actor: payload.actor || null,
        at,
        title,
        detail
    };
}

// Tạo thông báo nhân viên mới tham gia.
function createEmployeeNotification(payload, at) {
    const employee = payload.employee;
    if (!employee?.id) return null;

    const name = typeof employee.full_name === "string" && employee.full_name.trim()
        ? employee.full_name.trim()
        : "Nhân viên mới";
    const parts = [`Vai trò: ${ROLE_LABELS[employee.role] || "Nhân viên"}`];
    const addedBy = typeof payload.actor_name === "string" ? payload.actor_name.trim() : "";
    if (addedBy) parts.push(`Thêm bởi ${addedBy}`);

    return {
        key: createEventKey(payload.type, payload.event_id, at),
        type: payload.type,
        category: NOTIFICATION_CATEGORY.TEAM,
        appearance: "team",
        target: "employees",
        actor: payload.actor || null,
        at,
        title: `${name} đã tham gia`,
        detail: parts.join(" · ")
    };
}

// Tạo thông báo từ dữ liệu máy chủ gửi xuống; trả về null với loại thông báo chưa biết hoặc dữ liệu thiếu.
export function createNotificationFromPayload(payload, { at = Date.now() } = {}) {
    switch (payload?.type) {
        case NOTIFICATION_TYPE.NEW:
        case NOTIFICATION_TYPE.COMPLETED:
            return createOrderNotification(payload.type, payload.order, { actor: payload.actor, at });
        case NOTIFICATION_TYPE.MENU_CREATED:
        case NOTIFICATION_TYPE.MENU_UPDATED:
        case NOTIFICATION_TYPE.MENU_DELETED:
            return createMenuNotification(payload, at);
        case NOTIFICATION_TYPE.EMPLOYEE_JOINED:
            return createEmployeeNotification(payload, at);
        default:
            return null;
    }
}
