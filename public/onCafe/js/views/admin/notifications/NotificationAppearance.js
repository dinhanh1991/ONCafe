// Biểu tượng và lớp màu cho từng loại thông báo; dùng chung cho thông báo nổi và danh sách trong chuông.
const BY_TYPE = {
    menu_created: { icon: "bi bi-plus-circle-fill", className: "is-menu" },
    menu_updated: { icon: "bi bi-pencil-square", className: "is-menu" },
    menu_deleted: { icon: "bi bi-trash3-fill", className: "is-menu" },
    employee_joined: { icon: "bi bi-person-plus-fill", className: "is-team" }
};

const BY_APPEARANCE = {
    new: { icon: "bi bi-bag-plus-fill", className: "is-new" },
    completed: { icon: "bi bi-check-circle-fill", className: "is-completed" },
    menu: { icon: "bi bi-cup-hot-fill", className: "is-menu" },
    team: { icon: "bi bi-person-plus-fill", className: "is-team" }
};

// Lấy biểu tượng và lớp màu của một thông báo (theo loại, nếu không có thì theo kiểu hiển thị chung).
export function getAppearance(notification) {
    return BY_TYPE[notification?.type] || BY_APPEARANCE[notification?.appearance] || BY_APPEARANCE.new;
}
