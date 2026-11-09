// Chuông thông báo trên đầu trang: số chưa xem, danh sách gần đây, trạng thái kết nối và các cài đặt.
// View chỉ vẽ theo dữ liệu được truyền vào render(); mọi hành động được báo ngược qua callback.

// Tạo phần tử HTML với lớp và nội dung văn bản an toàn.
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

export class NotificationBell {
    // Khởi tạo đối tượng với các callback xử lý hành động của nhân viên.
    constructor({ onOpenOrders, onToggleSound, onRequestPermission, onPanelOpened }) {
        this.onOpenOrders = onOpenOrders;
        this.onToggleSound = onToggleSound;
        this.onRequestPermission = onRequestPermission;
        this.onPanelOpened = onPanelOpened;
        this.state = { history: [], unread: 0, soundEnabled: true, permission: "default", connected: false };
        this.button = null;
        this.badge = null;
        this.panel = null;
        this.status = null;
        this.soundButton = null;
        this.permissionButton = null;
        this.list = null;
    }

    // Gắn chuông vào đầu trang, đặt trước nút đăng xuất.
    mount(header = document.querySelector(".site-header")) {
        if (!header || this.button) return this;

        const wrapper = createElement("div", "order-bell");
        this.button = createElement("button", "header-button order-bell-button");
        this.button.type = "button";
        this.button.setAttribute("aria-haspopup", "true");
        this.button.setAttribute("aria-expanded", "false");
        const icon = createElement("i", "bi bi-bell-fill");
        icon.setAttribute("aria-hidden", "true");
        this.badge = createElement("span", "order-bell-badge");
        this.badge.hidden = true;
        this.button.append(icon, this.badge);

        this.panel = createElement("section", "order-bell-panel");
        this.panel.hidden = true;
        this.panel.setAttribute("aria-label", "Danh sách thông báo đơn hàng");
        const heading = createElement("div", "order-bell-heading");
        heading.append(createElement("strong", "", "Thông báo đơn hàng"));
        this.status = createElement("p", "order-bell-status");
        const actions = createElement("div", "order-bell-actions");
        this.soundButton = createElement("button", "order-bell-link");
        this.soundButton.type = "button";
        this.permissionButton = createElement("button", "order-bell-link");
        this.permissionButton.type = "button";
        actions.append(this.soundButton, this.permissionButton);
        this.list = createElement("ul", "order-bell-list");
        this.panel.append(heading, this.status, actions, this.list);
        wrapper.append(this.button, this.panel);

        const logoutButton = header.querySelector("#logoutButton");
        if (logoutButton) header.insertBefore(wrapper, logoutButton);
        else header.append(wrapper);

        this.button.addEventListener("click", () => this.toggle());
        this.soundButton.addEventListener("click", () => this.onToggleSound?.());
        this.permissionButton.addEventListener("click", () => this.onRequestPermission?.());
        this.list.addEventListener("click", (event) => {
            if (!event.target.closest("[data-notification-item]")) return;
            this.close();
            this.onOpenOrders?.();
        });
        document.addEventListener("click", (event) => {
            if (!this.panel.hidden && !wrapper.contains(event.target)) this.close();
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !this.panel.hidden) {
                this.close();
                this.button.focus();
            }
        });

        this.render(this.state);
        return this;
    }

    // Vẽ lại chuông và bảng thông báo theo dữ liệu mới.
    render(state) {
        this.state = { ...this.state, ...state };
        if (!this.button) return;
        const { history, unread, soundEnabled, permission, connected } = this.state;

        this.badge.hidden = unread === 0;
        this.badge.textContent = unread > 9 ? "9+" : String(unread);
        this.button.setAttribute(
            "aria-label",
            unread ? `Thông báo đơn hàng, ${unread} thông báo chưa xem` : "Thông báo đơn hàng"
        );

        this.status.textContent = connected
            ? "Đang nhận thông báo trực tiếp."
            : "Đang kiểm tra định kỳ (chưa có kết nối trực tiếp).";
        this.status.classList.toggle("is-connected", connected);

        this.soundButton.textContent = soundEnabled ? "Tắt âm báo" : "Bật âm báo";
        this.permissionButton.hidden = permission === "unsupported";
        this.permissionButton.disabled = permission !== "default";
        this.permissionButton.textContent = permission === "granted"
            ? "Thông báo trình duyệt: đã bật"
            : permission === "denied"
                ? "Thông báo trình duyệt đang bị chặn"
                : "Bật thông báo trình duyệt";

        this.list.replaceChildren();
        if (!history.length) this.list.append(createElement("li", "order-bell-empty", "Chưa có thông báo nào."));
        for (const item of history) {
            const row = createElement("li", "order-bell-item");
            const entry = createElement("button", `order-bell-entry is-${item.type === "completed" ? "completed" : "new"}`);
            entry.type = "button";
            entry.dataset.notificationItem = "true";
            const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
                .format(new Date(item.at));
            entry.append(createElement("strong", "", item.title), createElement("span", "", item.detail), createElement("small", "", time));
            row.append(entry);
            this.list.append(row);
        }
    }

    // Mở hoặc đóng bảng thông báo; mở bảng được tính là đã xem.
    toggle() {
        if (this.panel.hidden) {
            this.panel.hidden = false;
            this.button.setAttribute("aria-expanded", "true");
            this.onPanelOpened?.();
        } else {
            this.close();
        }
    }

    // Đóng bảng thông báo.
    close() {
        this.panel.hidden = true;
        this.button.setAttribute("aria-expanded", "false");
    }
}
