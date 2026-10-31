/**
 * CustomerCheckoutView
 * Chịu trách nhiệm hiển thị và cập nhật giao diện checkout.
 * Không xử lý nghiệp vụ đặt hàng hoặc truy cập service/repository.
 */
export class CustomerCheckoutView {
    constructor({ form, message, totalSummary, currencyFormatter }) {
        this.form = form;
        this.message = message;
        this.totalSummary = totalSummary;
        this.currencyFormatter = currencyFormatter;
    }

    bindFulfillmentChange(onChange) {
        this.form?.querySelector('[name="fulfillmentMethod"]')
            ?.addEventListener("change", onChange);
    }

    showForm(user, profile) {
        if (!this.form) return;

        const fullNameInput = this.form.querySelector('[name="fullName"]');
        const phoneInput = this.form.querySelector('[name="phone"]');
        const addressInput = this.form.querySelector('[name="address"]');

        if (fullNameInput && !fullNameInput.value.trim()) {
            fullNameInput.value = user.user_metadata?.full_name || profile?.full_name || "";
        }
        if (phoneInput && !phoneInput.value) phoneInput.value = profile?.phone || "";
        if (addressInput && !addressInput.value) addressInput.value = profile?.address || "";

        this.form.hidden = false;
        this.form.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    updateSummary(productTotal) {
        if (!this.totalSummary) return;

        const fulfillmentSelect = this.form?.querySelector('[name="fulfillmentMethod"]');
        const addressInput = this.form?.querySelector('[name="address"]');
        const isDelivery = fulfillmentSelect?.value === "delivery";
        const deliveryFee = isDelivery ? 15000 : 0;

        this.totalSummary.textContent =
            "Tạm tính: " + this.currencyFormatter.format(productTotal) +
            " · Phí giao hàng: " + this.currencyFormatter.format(deliveryFee) +
            " · Tổng: " + this.currencyFormatter.format(productTotal + deliveryFee);

        if (addressInput) {
            addressInput.required = true;
            addressInput.minLength = isDelivery ? 20 : 1;
            addressInput.placeholder = isDelivery
                ? "Nhập đầy đủ số nhà, tên đường/thôn xóm, phường/xã, quận/huyện và tỉnh/thành phố"
                : "Nhập địa chỉ hiện tại hoặc địa chỉ liên hệ";
        }

        const paymentSelect = this.form?.querySelector('[name="paymentMethod"]');
        if (paymentSelect) paymentSelect.value = "qr";
    }

    showMessage(message, isError = false) {
        if (!this.message) return;
        this.message.textContent = message;
        this.message.classList.toggle("checkout-message-error", isError);
    }

    setSubmitting(isSubmitting) {
        const submitButton = this.form?.querySelector("#submitOrderButton");
        if (submitButton) submitButton.disabled = isSubmitting;
    }

    hideForm() {
        if (this.form) this.form.hidden = true;
    }

    resetForm() {
        this.form?.reset();
    }
}
