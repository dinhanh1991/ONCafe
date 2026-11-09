// Chuẩn hóa thông báo hoạt động sản phẩm và nhân viên nhận từ Supabase Realtime.
const EVENT_CONFIG = Object.freeze({
    product_created: { category: "products", label: "Sản phẩm mới" },
    product_updated: { category: "products", label: "Sản phẩm được cập nhật" },
    product_deleted: { category: "products", label: "Sản phẩm đã bị xóa" },
    employee_created: { category: "employees", label: "Nhân viên mới" }
});

export function createStaffActivityNotification(payload) {
    const config = EVENT_CONFIG[payload?.type];
    const entity = payload?.entity;
    if (!config || !entity?.id) return null;

    const key = `${payload.type}:${entity.id}:${payload.event_id || payload.at || ""}`;
    const name = String(entity.name || entity.full_name || entity.email || `#${entity.id}`);
    const detail = payload.type === "employee_created"
        ? [name, entity.role].filter(Boolean).join(" · ")
        : [name, payload.changes_summary].filter(Boolean).join(" · ");

    return {
        key,
        type: payload.type,
        category: config.category,
        title: `${config.label}: ${name}`,
        detail,
        at: payload.at ? new Date(payload.at).getTime() : Date.now(),
        actor: payload.actor || null,
        includeActor: true
    };
}
