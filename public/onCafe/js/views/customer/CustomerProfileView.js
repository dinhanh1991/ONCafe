// Hiển thị và xử lý biểu mẫu hồ sơ khách hàng.
import { CustomerValidator } from "../../validators/CustomerValidator.js";
import { ValidationUI } from "../../validators/ValidationUI.js";

export class CustomerProfileView {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(container, { onLoad, onSave, onChangePassword }) {
        this.container = container;
        this.onLoad = onLoad;
        this.onSave = onSave;
        this.onChangePassword = onChangePassword;
        this.isSaving = false;
        this.savedProfile = null;
        this.container.addEventListener("submit", (event) => void this.handleSubmit(event));
    }

    // Cập nhật nội dung giao diện do thành phần này quản lý.
    async render() {
        this.container.innerHTML = `
            <section class="customer-profile">
                <header class="customer-profile-heading">
                    <p class="eyebrow">TÀI KHOẢN ONCAFE</p>
                    <h1>Thông tin cá nhân</h1>
                    <p>Cập nhật thông tin liên hệ dùng cho đơn hàng và mật khẩu đăng nhập.</p>
                </header>
                <p class="customer-profile-feedback" data-profile-feedback role="status" aria-live="polite"></p>
                <form class="customer-profile-form" data-profile-form novalidate>
                    <label>
                        Họ và tên
                        <input name="fullName" type="text" minlength="2" maxlength="100" autocomplete="name" data-required-message="Vui lòng nhập họ và tên." required disabled>
                    </label>
                    <label>
                        Email đăng nhập
                        <input name="email" type="email" autocomplete="email" readonly disabled>
                        <small>Email đăng nhập không thể thay đổi tại đây.</small>
                    </label>
                    <label>
                        Số điện thoại
                        <input name="phone" type="tel" maxlength="25" autocomplete="tel" placeholder="Ví dụ: 0912345678" data-required-message="Vui lòng nhập số điện thoại." required disabled>
                    </label>
                    <label class="customer-profile-address">
                        Địa chỉ
                        <textarea name="address" maxlength="250" rows="3" autocomplete="street-address" placeholder="Địa chỉ liên hệ hoặc địa chỉ nhận hàng" data-required-message="Vui lòng nhập địa chỉ." required disabled></textarea>
                    </label>
                    <div class="customer-profile-actions">
                        <button class="customer-profile-save" type="submit" disabled>Lưu thông tin</button>
                    </div>
                </form>
                <form class="customer-profile-form customer-profile-password-form" data-password-form novalidate>
                    <h2>Đổi mật khẩu</h2>
                    <p class="customer-profile-password-help">Mật khẩu mới cần có ít nhất 8 ký tự.</p>
                    <label>
                        Mật khẩu mới
                        <input name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" data-required-message="Vui lòng nhập mật khẩu mới." required>
                    </label>
                    <label>
                        Xác nhận mật khẩu mới
                        <input name="confirmPassword" type="password" minlength="8" maxlength="72" autocomplete="new-password" data-required-message="Vui lòng xác nhận mật khẩu mới." required>
                    </label>
                    <div class="customer-profile-actions">
                        <button class="customer-profile-save" type="submit">Đổi mật khẩu</button>
                    </div>
                </form>
            </section>`;

        this.container.querySelectorAll("form").forEach((form) => ValidationUI.bind(form));
        await this.load();
    }

    // Tải dữ liệu cần thiết cho thành phần.
    async load() {
        const feedback = this.container.querySelector("[data-profile-feedback]");
        renderCoffeeLoading(feedback, "Đang tải thông tin cá nhân...", { compact: true });

        try {
            const result = await this.onLoad();
            clearCoffeeLoading(feedback);
            if (!result) return;
            const { profile, email } = result;
            const form = this.container.querySelector("[data-profile-form]");
            form.elements.fullName.value = profile.full_name || "";
            form.elements.email.value = email || "";
            form.elements.phone.value = profile.phone || "";
            form.elements.address.value = profile.address || "";
            this.savedProfile = {
                fullName: form.elements.fullName.value,
                phone: form.elements.phone.value,
                address: form.elements.address.value
            };
            form.elements.fullName.disabled = false;
            form.elements.phone.disabled = false;
            form.elements.address.disabled = false;
            form.querySelector('button[type="submit"]').disabled = false;
            feedback.textContent = "";
        } catch (error) {
            console.error("Không thể tải hồ sơ khách hàng:", error);
            feedback.textContent = error.message || "Không thể tải thông tin cá nhân.";
            feedback.classList.add("is-error");
        }
    }

    // Kiểm tra và xử lý việc gửi biểu mẫu.
    async handleSubmit(event) {
        const form = event.target;
        if (!form.matches("[data-profile-form], [data-password-form]")) return;
        event.preventDefault();
        if (this.isSaving) return;

        if (form.matches("[data-password-form]")) {
            await this.handlePasswordSubmit(form);
            return;
        }

        const feedback = this.container.querySelector("[data-profile-feedback]");
        const fullName = form.elements.fullName.value.trim();
        const phone = form.elements.phone.value.trim();
        const address = form.elements.address.value.trim();
        const validation = CustomerValidator.validate({ phone }, { phoneRequired: true });
        const errors = { ...validation.errors };

        if (!fullName) {
            errors.fullName = "Vui lòng nhập họ và tên.";
        } else if (fullName.length < 2 || fullName.length > 100) {
            errors.fullName = "Họ và tên phải có từ 2 đến 100 ký tự.";
        }
        if (!address) {
            errors.address = "Vui lòng nhập địa chỉ.";
        } else if (address.length > 250) {
            errors.address = "Địa chỉ không được vượt quá 250 ký tự.";
        }
        if (Object.keys(errors).length) {
            ValidationUI.showErrors(form, errors);
            return;
        }

        ValidationUI.clearErrors(form);
        feedback.classList.remove("is-error");
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
            feedback.textContent = "Đã hủy quá trình lưu. Thông tin cũ được giữ nguyên.";
            await this.showDialog({
                title: "Đã hủy thay đổi",
                message: "Thông tin cũ được giữ nguyên.",
                confirmText: "Đóng"
            });
            return;
        }

        feedback.textContent = "Đang lưu thông tin...";
        this.isSaving = true;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;

        try {
            await this.onSave({ fullName, phone, address });
            this.savedProfile = { fullName, phone, address };
            form.elements.fullName.value = fullName;
            form.elements.phone.value = phone;
            form.elements.address.value = address;
            feedback.textContent = "Đã lưu thay đổi thông tin cá nhân thành công.";
            await this.showDialog({
                title: "Lưu thành công",
                message: "Thông tin cá nhân của bạn đã được cập nhật.",
                confirmText: "Đóng"
            });
        } catch (error) {
            console.error("Không thể lưu hồ sơ khách hàng:", error);
            feedback.textContent = error.message || "Không thể lưu thông tin cá nhân.";
            feedback.classList.add("is-error");
        } finally {
            this.isSaving = false;
            button.disabled = false;
        }
    }

    // Hiển thị hộp thoại với nội dung và thao tác được cung cấp.
    showDialog({ title, message, confirmText, cancelText }) {
        return new Promise((resolve) => {
            const dialog = document.createElement("dialog");
            dialog.className = "customer-profile-dialog";

            const heading = document.createElement("h2");
            heading.textContent = title;
            const description = document.createElement("p");
            description.textContent = message;
            const actions = document.createElement("div");
            actions.className = "customer-profile-dialog-actions";

            if (cancelText) {
                const cancelButton = document.createElement("button");
                cancelButton.type = "button";
                cancelButton.className = "customer-profile-dialog-cancel";
                cancelButton.textContent = cancelText;
                cancelButton.addEventListener("click", () => dialog.close("cancel"));
                actions.append(cancelButton);
            }

            const confirmButton = document.createElement("button");
            confirmButton.type = "button";
            confirmButton.className = "customer-profile-save";
            confirmButton.textContent = confirmText;
            confirmButton.addEventListener("click", () => dialog.close("confirm"));
            actions.append(confirmButton);
            dialog.append(heading, description, actions);
            dialog.addEventListener("close", () => {
                dialog.remove();
                resolve(dialog.returnValue === "confirm");
            }, { once: true });

            document.body.append(dialog);
            dialog.showModal();
            (cancelText ? actions.firstElementChild : confirmButton).focus();
        });
    }

    // Kiểm tra và gửi yêu cầu cập nhật mật khẩu.
    async handlePasswordSubmit(form) {
        const password = form.elements.password.value;
        const confirmPassword = form.elements.confirmPassword.value;
        const errors = {};

        if (!password) {
            errors.password = "Vui lòng nhập mật khẩu mới.";
        } else if (password.length < 8) {
            errors.password = "Mật khẩu mới cần có ít nhất 8 ký tự.";
        } else if (password.length > 72) {
            errors.password = "Mật khẩu mới không được vượt quá 72 ký tự.";
        }
        if (!confirmPassword) {
            errors.confirmPassword = "Vui lòng xác nhận mật khẩu mới.";
        } else if (password !== confirmPassword) {
            errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
        }

        if (Object.keys(errors).length) {
            ValidationUI.showErrors(form, errors);
            return;
        }

        ValidationUI.clearErrors(form);
        const feedback = this.container.querySelector("[data-profile-feedback]");
        const button = form.querySelector('button[type="submit"]');
        feedback.classList.remove("is-error");
        feedback.textContent = "Đang đổi mật khẩu...";
        this.isSaving = true;
        button.disabled = true;

        try {
            await this.onChangePassword(password);
            form.reset();
            feedback.textContent = "Đã đổi mật khẩu thành công.";
        } catch (error) {
            console.error("Không thể đổi mật khẩu khách hàng:", error);
            feedback.textContent = error.message || "Không thể đổi mật khẩu.";
            feedback.classList.add("is-error");
        } finally {
            this.isSaving = false;
            button.disabled = false;
        }
    }
}
