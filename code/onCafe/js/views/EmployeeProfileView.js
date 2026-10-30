import { CustomerValidator } from "../validators/CustomerValidator.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

export class EmployeeProfileView {
    constructor(container, { onLoad, onSave, onChangePassword }) {
        this.container = container;
        this.onLoad = onLoad;
        this.onSave = onSave;
        this.onChangePassword = onChangePassword;
        this.busy = false;
        container.addEventListener("submit", (event) => void this.handleSubmit(event));
    }

    async render() {
        this.container.innerHTML = `
            <section class="employee-profile">
                <header class="product-heading">
                    <div><p class="eyebrow">TÀI KHOẢN CỦA TÔI</p><h2>Thông tin cá nhân</h2>
                    <p>Cập nhật thông tin liên hệ và mật khẩu đăng nhập.</p></div>
                </header>
                <p data-profile-feedback role="status" aria-live="polite"></p>
                <form class="product-form" data-profile-form>
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
                <form class="product-form" data-password-form>
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
        await this.load();
    }

    async load() {
        const feedback = this.container.querySelector("[data-profile-feedback]");
        feedback.textContent = "Đang tải thông tin tài khoản...";
        try {
            const profile = await this.onLoad();
            const form = this.container.querySelector("[data-profile-form]");
            form.elements.fullName.value = profile.full_name || "";
            form.elements.phone.value = profile.phone || "";
            form.elements.address.value = profile.address || "";
            form.elements.email.value = profile.email || "";
            form.elements.role.value = this.roleLabel(profile.role);
            feedback.textContent = "";
        } catch (error) {
            feedback.textContent = error.message || "Không thể tải thông tin tài khoản.";
            feedback.className = "app-error";
        }
    }

    roleLabel(role) {
        const labels = { admin: "Quản trị viên", seller: "Người bán hàng", cashier: "Thu ngân", customer: "Khách hàng" };
        return labels[role] || "Chưa xác định";
    }

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
                if (!validation.isValid) {
                    form.elements.phone.focus();
                    throw new Error(validation.errors.phone);
                }
                await this.onSave({
                    fullName: form.elements.fullName.value.trim(),
                    phone: form.elements.phone.value.trim(),
                    address: form.elements.address.value.trim()
                });
                feedback.textContent = "Đã lưu thông tin cá nhân.";
            } else {
                const password = form.elements.password.value;
                const confirmPassword = form.elements.confirmPassword.value;
                if (password.length < 8) throw new Error("Mật khẩu mới cần có ít nhất 8 ký tự.");
                if (password !== confirmPassword) throw new Error("Mật khẩu xác nhận không khớp.");
                await this.onChangePassword(password);
                form.reset();
                feedback.textContent = "Đã đổi mật khẩu thành công.";
            }
        } catch (error) {
            feedback.textContent = error.message || "Không thể lưu thay đổi.";
            feedback.className = "app-error";
        } finally {
            this.busy = false;
            buttons.forEach((button) => { button.disabled = false; });
        }
    }
}
