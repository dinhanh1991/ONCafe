import { renderCoffeeLoading, clearCoffeeLoading, waitForCoffeeLoading } from "../../utils/CoffeeLoading.js";
// Hiển thị và chỉnh sửa hồ sơ nhân viên đang đăng nhập.
import { CustomerValidator } from "../../validators/CustomerValidator.js";
import { ValidationUI } from "../../validators/ValidationUI.js";

// Mã hóa ký tự đặc biệt trước khi chèn dữ liệu vào HTML.
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

export class EmployeeProfileView {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(container, { onLoad, onSave, onChangePassword }) {
        this.container = container;
        this.onLoad = onLoad;
        this.onSave = onSave;
        this.onChangePassword = onChangePassword;
        this.busy = false;
        this.savedProfile = null;
        container.addEventListener("submit", (event) => void this.handleSubmit(event));
        container.addEventListener("focusin", (event) => {
            const form = event.target.closest("[data-profile-form], [data-password-form]");
            if (form) ValidationUI.bind(form);
        });
    }

    // Cập nhật nội dung giao diện do thành phần này quản lý.
    async render() {
        this.container.innerHTML = `
            <section class="employee-profile">
                <header class="product-heading">
                    <div><p class="eyebrow">TÀI KHOẢN CỦA TÔI</p><h2>Thông tin cá nhân</h2>
                    <p>Cập nhật thông tin liên hệ và mật khẩu đăng nhập.</p></div>
                </header>
                <p data-profile-feedback role="status" aria-live="polite"></p>
                <form class="product-form" data-profile-form novalidate>
                    <h3>Thông tin tài khoản</h3>
                    <div class="product-form-grid">
                        <label>Họ và tên
                            <input name="fullName" type="text" minlength="2" maxlength="100" autocomplete="name" required>
                        </label>
                        <label>Số điện thoại
                            <input name="phone" type="tel" maxlength="25" autocomplete="tel">
                        </label>
                        <label class="profile-address">Địa chỉ
                            <input name="address" type="text" maxlength="250" autocomplete="street-address">
                        </label>
                        <label>Email đăng nhập (không thể thay đổi)
                            <input name="email" type="email" readonly disabled>
                        </label>
                        <label>Vai trò tài khoản (không thể thay đổi)
                            <input name="role" type="text" readonly disabled>
                        </label>
                    </div>
                    <div class="form-actions"><button class="button button-primary" type="submit">Lưu thông tin</button></div>
                </form>
                <form class="product-form" data-password-form novalidate>
                    <h3>Đổi mật khẩu</h3>
                    <p class="image-help">Mật khẩu mới cần có ít nhất 8 ký tự.</p>
                    <div class="product-form-grid">
                        <label>Mật khẩu mới
                            <input name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" required>
                        </label>
                        <label>Xác nhận mật khẩu mới
                            <input name="confirmPassword" type="password" minlength="8" maxlength="72" autocomplete="new-password" required>
                        </label>
                    </div>
                    <div class="form-actions"><button class="button button-primary" type="submit">Đổi mật khẩu</button></div>
                </form>
            </section>`;
        this.container.querySelectorAll("form").forEach((form) => ValidationUI.bind(form));
        this.container.querySelector('[data-profile-form] button[type="submit"]').disabled = true;
        await this.load();
    }

    // Tải dữ liệu cần thiết cho thành phần.
    async load() {
        const feedback = this.container.querySelector("[data-profile-feedback]");
        renderCoffeeLoading(feedback, "Đang tải thông tin nhân viên...", { compact: true });
        try {
            const profile = await this.onLoad();
            await waitForCoffeeLoading(feedback);
            clearCoffeeLoading(feedback);
            const form = this.container.querySelector("[data-profile-form]");
            form.elements.fullName.value = profile.full_name || "";
            form.elements.phone.value = profile.phone || "";
            form.elements.address.value = profile.address || "";
            form.elements.email.value = profile.email || "";
            form.elements.role.value = this.roleLabel(profile.role);
            this.savedProfile = {
                fullName: form.elements.fullName.value,
                phone: form.elements.phone.value,
                address: form.elements.address.value
            };
            form.querySelector('button[type="submit"]').disabled = false;
            feedback.textContent = "";
        } catch (error) {
            await waitForCoffeeLoading(feedback);
            clearCoffeeLoading(feedback);
            feedback.textContent = error.message || "Không thể tải thông tin tài khoản.";
            feedback.className = "app-error";
        }
    }

    // Chuyển mã vai trò thành tên hiển thị cho người dùng.
    roleLabel(role) {
        const labels = { admin: "Quản trị viên", seller: "Người bán hàng", cashier: "Thu ngân", customer: "Khách hàng" };
        return labels[role] || "Chưa xác định";
    }

    // Kiểm tra và xử lý việc gửi biểu mẫu.
    async handleSubmit(event) {
        const form = event.target;
        if (!form.matches("[data-profile-form], [data-password-form]")) return;
        event.preventDefault();
        if (this.busy) return;

        const feedback = this.container.querySelector("[data-profile-feedback]");
        feedback.className = "";
        feedback.textContent = "";
        this.busy = true;
        const buttons = this.container.querySelectorAll('button[type="submit"]');
        buttons.forEach((button) => { button.disabled = true; });

        try {
            if (form.matches("[data-profile-form]")) {
                const validation = CustomerValidator.validate({ phone: form.elements.phone.value });
                const errors = { ...validation.errors };
                const fullName = form.elements.fullName.value.trim();
                if (fullName.length < 2) {
                    errors.fullName = "Vui lòng nhập họ tên (ít nhất 2 ký tự).";
                }
                ValidationUI.bind(form);
                if (Object.keys(errors).length > 0) {
                    ValidationUI.showErrors(form, errors);
                    return;
                }
                ValidationUI.clearErrors(form);
                const profile = {
                    fullName: form.elements.fullName.value.trim(),
                    phone: form.elements.phone.value.trim(),
                    address: form.elements.address.value.trim()
                };
                const confirmed = await this.showDialog({
                    title: "Xác nhận lưu thông tin",
                    message: "Bạn có muốn lưu các thay đổi thông tin cá nhân không?",
                    confirmText: "Lưu thay đổi",
                    cancelText: "Hủy"
                });
                if (!confirmed) {
                    form.elements.fullName.value = this.savedProfile.fullName;
                    form.elements.phone.value = this.savedProfile.phone;
                    form.elements.address.value = this.savedProfile.address;
                    feedback.textContent = "Đã hủy lưu thông tin. Thông tin cũ được giữ nguyên.";
                    await this.showDialog({
                        type: "info",
                        title: "Đã hủy thay đổi",
                        message: "Thông tin cá nhân cũ được giữ nguyên.",
                        hideCancel: true
                    });
                    return;
                }

                await this.onSave(profile);
                this.savedProfile = profile;
                feedback.textContent = "Đã lưu thông tin cá nhân thành công.";
                await this.showDialog({
                    type: "success",
                    title: "Lưu thành công",
                    message: "Thông tin cá nhân của bạn đã được cập nhật.",
                    hideCancel: true
                });
            } else {
                const password = form.elements.password.value;
                const confirmPassword = form.elements.confirmPassword.value;
                ValidationUI.bind(form);
                if (!password) {
                    ValidationUI.showErrors(form, { password: "Vui lòng nhập mật khẩu mới." });
                    return;
                }
                if (password.length < 8) {
                    ValidationUI.showErrors(form, { password: "Mật khẩu mới cần có ít nhất 8 ký tự." });
                    return;
                }
                if (!confirmPassword) {
                    ValidationUI.showErrors(form, { confirmPassword: "Vui lòng xác nhận mật khẩu mới." });
                    return;
                }
                if (password !== confirmPassword) {
                    ValidationUI.showErrors(form, { confirmPassword: "Mật khẩu xác nhận không khớp." });
                    return;
                }
                ValidationUI.clearErrors(form);
                const confirmed = await this.showDialog({
                    title: "Xác nhận đổi mật khẩu",
                    message: "Bạn có chắc chắn muốn đổi mật khẩu đăng nhập không?",
                    confirmText: "Đổi mật khẩu",
                    cancelText: "Hủy"
                });
                if (!confirmed) {
                    form.reset();
                    feedback.textContent = "Đã hủy đổi mật khẩu. Mật khẩu hiện tại được giữ nguyên.";
                    await this.showDialog({
                        type: "info",
                        title: "Đã hủy đổi mật khẩu",
                        message: "Mật khẩu hiện tại được giữ nguyên.",
                        hideCancel: true
                    });
                    return;
                }

                await this.onChangePassword(password);
                form.reset();
                feedback.textContent = "Đã đổi mật khẩu thành công.";
                await this.showDialog({
                    type: "success",
                    title: "Đổi mật khẩu thành công",
                    message: "Mật khẩu đăng nhập của bạn đã được cập nhật.",
                    hideCancel: true
                });
            }
        } catch (error) {
            feedback.textContent = error.message || "Không thể lưu thay đổi.";
            feedback.className = "app-error";
        } finally {
            this.busy = false;
            buttons.forEach((button) => { button.disabled = false; });
        }
    }

    // Hiển thị hộp thoại xác nhận hoặc thông báo.
    showDialog({
        type = "info",
        title,
        message,
        confirmText = "Xác nhận",
        cancelText = "Hủy",
        hideCancel = false
    }) {
        return new Promise((resolve) => {
            const backdrop = document.createElement("div");
            backdrop.className = "app-dialog-backdrop";
            backdrop.setAttribute("role", "presentation");

            const dialog = document.createElement("section");
            dialog.className = "app-dialog";
            dialog.dataset.type = type;
            dialog.setAttribute("role", "dialog");
            dialog.setAttribute("aria-modal", "true");
            dialog.setAttribute("aria-labelledby", "employee-profile-dialog-title");
            dialog.setAttribute("aria-describedby", "employee-profile-dialog-message");

            const icon = document.createElement("div");
            icon.className = "dialog-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = type === "success" ? "✓" : type === "error" ? "×" : "?";

            const heading = document.createElement("h3");
            heading.id = "employee-profile-dialog-title";
            heading.textContent = title;
            const description = document.createElement("p");
            description.id = "employee-profile-dialog-message";
            description.textContent = message;

            const actions = document.createElement("div");
            actions.className = "dialog-actions";
            let cancelButton;
            if (!hideCancel) {
                cancelButton = document.createElement("button");
                cancelButton.type = "button";
                cancelButton.className = "button button-secondary";
                cancelButton.textContent = cancelText;
                actions.append(cancelButton);
            }

            const confirmButton = document.createElement("button");
            confirmButton.type = "button";
            confirmButton.className = "button button-primary";
            confirmButton.textContent = hideCancel ? "Đóng" : confirmText;
            actions.append(confirmButton);
            dialog.append(icon, heading, description, actions);
            backdrop.append(dialog);
            document.body.append(backdrop);

            let finished = false;
            const handleBackdropClick = (event) => {
                if (event.target === backdrop) finish(false);
            };
            const handleKeydown = (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    finish(false);
                }
            };
            const finish = (confirmed) => {
                if (finished) return;
                finished = true;
                backdrop.removeEventListener("click", handleBackdropClick);
                backdrop.removeEventListener("keydown", handleKeydown);
                backdrop.remove();
                resolve(confirmed);
            };
            confirmButton.addEventListener("click", () => finish(true), { once: true });
            cancelButton?.addEventListener("click", () => finish(false), { once: true });
            backdrop.addEventListener("click", handleBackdropClick);
            backdrop.addEventListener("keydown", handleKeydown);
            (cancelButton || confirmButton).focus();
        });
    }
}
