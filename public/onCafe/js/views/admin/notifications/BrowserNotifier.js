// Hiển thị thông báo của hệ điều hành/trình duyệt khi nhân viên đang ở tab hoặc cửa sổ khác.
export class BrowserNotifier {
    // Khởi tạo đối tượng; onClick được gọi khi nhân viên nhấn vào thông báo.
    constructor({ onClick }) {
        this.onClick = onClick;
    }

    // Trình duyệt có hỗ trợ Notification API hay không.
    get supported() {
        return typeof window !== "undefined" && "Notification" in window;
    }

    // Quyền hiện tại: default, granted, denied hoặc unsupported.
    get permission() {
        return this.supported ? Notification.permission : "unsupported";
    }

    // Xin quyền hiển thị thông báo (bắt buộc gọi từ thao tác nhấn của người dùng).
    async requestPermission() {
        if (!this.supported || Notification.permission !== "default") return this.permission;
        try {
            await Notification.requestPermission();
        } catch {
            // Người dùng đóng hộp thoại hoặc trình duyệt không hỗ trợ.
        }
        return this.permission;
    }

    // Hiển thị một thông báo nếu đã được cấp quyền; onClick riêng cho từng thông báo (mặc định dùng onClick chung).
    show(title, body, onClick = this.onClick) {
        if (this.permission !== "granted") return;
        try {
            const notification = new Notification(title, { body, tag: "oncafe-staff-notifications" });
            notification.addEventListener("click", () => {
                window.focus();
                notification.close();
                onClick?.();
            });
        } catch {
            // Một số trình duyệt di động không cho tạo Notification trực tiếp.
        }
    }
}
