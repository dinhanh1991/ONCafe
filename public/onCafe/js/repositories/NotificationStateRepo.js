// Lưu trạng thái thông báo của từng tài khoản trên trình duyệt: ảnh chụp đơn hàng, khóa đã báo, lịch sử và cài đặt.
// Nếu Local Storage bị chặn hoặc đầy, dữ liệu vẫn được giữ trong bộ nhớ của trang hiện tại.
const PREFIX = "oncafe:notifications";
const MAX_SEEN_KEYS = 300;
const MAX_HISTORY = 20;

export class NotificationStateRepository {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor({ userId, storage = window.localStorage }) {
        if (!userId) throw new Error("NotificationStateRepository cần mã tài khoản.");
        this.userId = userId;
        this.storage = storage;
        this.memory = new Map();
    }

    // Tạo khóa lưu trữ riêng cho từng tài khoản để nhiều nhân viên dùng chung máy không lẫn dữ liệu.
    storageKey(name) {
        return `${PREFIX}:${this.userId}:${name}`;
    }

    // Đọc một giá trị JSON; ưu tiên storage, nếu lỗi thì dùng bản trong bộ nhớ.
    read(name, fallback) {
        try {
            const raw = this.storage?.getItem(this.storageKey(name));
            if (raw !== null && raw !== undefined) return JSON.parse(raw);
        } catch {
            // Storage bị chặn hoặc dữ liệu hỏng.
        }
        return this.memory.has(name) ? this.memory.get(name) : fallback;
    }

    // Ghi một giá trị JSON; luôn giữ thêm một bản trong bộ nhớ.
    write(name, value) {
        this.memory.set(name, value);
        try {
            this.storage?.setItem(this.storageKey(name), JSON.stringify(value));
        } catch {
            // Không ghi được vào storage thì vẫn hoạt động trong phiên trang hiện tại.
        }
    }

    // Lấy ảnh chụp trạng thái đơn hàng của lần đồng bộ trước (mã đơn → trạng thái).
    getSnapshot() {
        const value = this.read("snapshot", null);
        return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    }

    // Lưu ảnh chụp trạng thái đơn hàng.
    saveSnapshot(snapshot) {
        this.write("snapshot", snapshot);
    }

    // Kiểm tra một sự kiện đã được báo hay chưa.
    hasSeen(key) {
        const keys = this.read("seen", []);
        return Array.isArray(keys) && keys.includes(key);
    }

    // Đánh dấu sự kiện đã được báo; chỉ giữ các khóa gần nhất để dữ liệu không phình to.
    addSeen(key) {
        const keys = this.read("seen", []);
        const list = Array.isArray(keys) ? keys : [];
        if (list.includes(key)) return;
        list.push(key);
        this.write("seen", list.slice(-MAX_SEEN_KEYS));
    }

    // Lấy lịch sử thông báo, mới nhất ở đầu.
    getHistory() {
        const value = this.read("history", []);
        return Array.isArray(value) ? value.slice(0, MAX_HISTORY) : [];
    }

    // Lưu lịch sử thông báo.
    saveHistory(history) {
        this.write("history", history.slice(0, MAX_HISTORY));
    }

    // Đọc cài đặt âm báo (mặc định bật).
    isSoundEnabled() {
        return this.read("sound", "on") !== "off";
    }

    // Lưu cài đặt âm báo.
    setSoundEnabled(enabled) {
        this.write("sound", enabled ? "on" : "off");
    }
}
