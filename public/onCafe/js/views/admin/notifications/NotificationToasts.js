// Thông báo nổi ở góc màn hình, tự ẩn sau vài giây. Nội dung luôn đặt bằng textContent để tránh chèn HTML.
const MAX_TOASTS = 3;
const TOAST_DURATION_MS = 9000;

// Tạo phần tử HTML với lớp và nội dung văn bản an toàn.
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

export class NotificationToasts {
    // Khởi tạo đối tượng; onOpen được gọi khi nhân viên nhấn vào nội dung thông báo.
    constructor({ onOpen }) {
        this.onOpen = onOpen;
        this.stack = null;
    }

    // Tạo vùng chứa thông báo nổi trong trang.
    mount() {
        if (this.stack) return this;
        this.stack = createElement("div", "order-toast-stack");
        this.stack.setAttribute("role", "status");
        this.stack.setAttribute("aria-live", "polite");
        document.body.append(this.stack);
        return this;
    }

    // Hiển thị một thông báo nổi; giữ tối đa vài thông báo cùng lúc.
    show({ type, title, detail }) {
        if (!this.stack) return;
        while (this.stack.children.length >= MAX_TOASTS) this.stack.firstElementChild.remove();

        const completed = type === "completed";
        const toast = createElement("div", `order-toast is-${completed ? "completed" : "new"}`);
        const icon = createElement("i", completed ? "bi bi-check-circle-fill" : "bi bi-bag-plus-fill");
        icon.setAttribute("aria-hidden", "true");
        const body = createElement("button", "order-toast-body");
        body.type = "button";
        body.append(createElement("strong", "", title), createElement("span", "", detail));
        const close = createElement("button", "order-toast-close", "×");
        close.type = "button";
        close.setAttribute("aria-label", "Đóng thông báo");
        toast.append(icon, body, close);
        this.stack.append(toast);

        const timer = window.setTimeout(() => toast.remove(), TOAST_DURATION_MS);
        close.addEventListener("click", () => {
            window.clearTimeout(timer);
            toast.remove();
        });
        body.addEventListener("click", () => {
            window.clearTimeout(timer);
            toast.remove();
            this.onOpen?.();
        });
    }
}
