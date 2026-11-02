import { CustomerValidator } from "../../validators/CustomerValidator.js";
import { ValidationUI } from "../../validators/ValidationUI.js";

export class CustomerProfileView {
    constructor(container, { onLoad, onSave }) {
        this.container = container;
        this.onLoad = onLoad;
        this.onSave = onSave;
        this.isSaving = false;
        this.savedProfile = null;
        this.container.addEventListener("submit", (event) => void this.handleSubmit(event));
    }

    async render() {
        this.container.innerHTML = `
            <section class="customer-profile">
                <header class="customer-profile-heading">
                    <p class="eyebrow">TÀI KHOẢN ONCAFE</p>
                    <h1>Thông tin cá nhân</h1>
                    <p>Xem và cập nhật thông tin liên hệ dùng cho các đơn hàng của bạn.</p>
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
                        <input name="phone" type="tel" maxlength="25" autocomplete="tel" placeholder="Ví dụ: 0912345678" required disabled>
                    </label>
                    <label class="customer-profile-address">
                        Địa chỉ
                        <textarea name="address" maxlength="250" rows="3" autocomplete="street-address" placeholder="Địa chỉ liên hệ hoặc địa chỉ nhận hàng" required disabled></textarea>
                    </label>
                    <div class="customer-profile-actions">
                        <button class="customer-profile-save" type="submit" disabled>Lưu thông tin</button>
                    </div>
                </form>
            </section>`;

        const form = this.container.querySelector("[data-profile-form]");
        ValidationUI.bind(form);
        await this.load();
    }

    async load() {
        const feedback = this.container.querySelector("[data-profile-feedback]");
        feedback.textContent = "Đang tải thông tin cá nhân...";

        try {
            const result = await this.onLoad();
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

    async handleSubmit(event) {
        const form = event.target;
        if (!form.matches("[data-profile-form]")) return;
        event.preventDefault();
        if (this.isSaving) return;

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
        if (!window.confirm("Bạn có muốn lưu các thay đổi thông tin cá nhân không?")) {
            form.elements.fullName.value = this.savedProfile.fullName;
            form.elements.phone.value = this.savedProfile.phone;
            form.elements.address.value = this.savedProfile.address;
            feedback.textContent = "Đã hủy quá trình lưu. Thông tin cũ được giữ nguyên.";
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
        } catch (error) {
            console.error("Không thể lưu hồ sơ khách hàng:", error);
            feedback.textContent = error.message || "Không thể lưu thông tin cá nhân.";
            feedback.classList.add("is-error");
        } finally {
            this.isSaving = false;
            button.disabled = false;
        }
    }
}
