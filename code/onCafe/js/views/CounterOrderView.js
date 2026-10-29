import { formatCurrency } from "../utils/FormatUtils.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export class CounterOrderView {
    constructor(container, { onLoadProducts, onCreateOrder, onCreated }) {
        this.container = container;
        this.onLoadProducts = onLoadProducts;
        this.onCreateOrder = onCreateOrder;
        this.onCreated = onCreated;
        this.products = [];
        this.cart = new Map();
        this.busy = false;
        this.container.addEventListener("submit", (event) => void this.handleSubmit(event));
        this.container.addEventListener("change", (event) => this.handleChange(event));
        this.container.addEventListener("click", (event) => this.handleClick(event));
    }

    async render() {
        this.container.innerHTML = `
            <section class="product-manager counter-order">
                <header class="product-heading"><div><p class="eyebrow">BÁN HÀNG TẠI QUẦY</p><h2>Tạo đơn hàng</h2><p>Chọn đồ uống, kiểm tra tồn kho và tạo đơn.</p></div>
                <button class="button" type="button" data-counter-refresh>↻ Tải lại đồ uống</button></header>
                <p data-counter-feedback role="status" aria-live="polite"></p>
                <form data-counter-form class="product-form">
                    <div class="product-form-grid">
                        <label>Tên khách hàng<input name="customerName" maxlength="100" value="Khách lẻ" required></label>
                        <label>Số điện thoại<input name="customerPhone" type="tel" maxlength="25" placeholder="Không bắt buộc"></label>
                        <label>Địa chỉ / ghi chú<input name="customerAddress" maxlength="250" placeholder="Không bắt buộc"></label>
                        <label>Thanh toán<select name="paymentMethod"><option value="cash">Tiền mặt</option><option value="qr">Chuyển khoản QR</option></select></label>
                    </div>
                    <h3>Chọn đồ uống</h3>
                    <div class="table-scroll"><table class="product-table"><thead><tr><th>Đồ uống</th><th>Giá</th><th>Tồn kho</th><th>Số lượng</th></tr></thead><tbody data-counter-products><tr><td colspan="4">Đang tải...</td></tr></tbody></table></div>
                    <h3>Giỏ hàng</h3><div data-counter-cart></div>
                    <p class="counter-total">Tổng tiền: <strong data-counter-total>0 ₫</strong></p>
                    <div class="form-actions"><button class="button button-primary" type="submit">Tạo đơn hàng</button></div>
                </form>
            </section>`;
        await this.loadProducts();
    }

    async loadProducts() {
        const feedback = this.container.querySelector("[data-counter-feedback]");
        feedback.textContent = "Đang tải đồ uống...";
        try {
            this.products = (await this.onLoadProducts()).filter((p) => p.status !== "inactive" && Number(p.quantity) > 0);
            this.renderProducts();
            feedback.textContent = "";
        } catch (error) {
            feedback.textContent = error.message || "Không thể tải đồ uống.";
            feedback.className = "app-error";
        }
    }

    renderProducts() {
        const body = this.container.querySelector("[data-counter-products]");
        body.innerHTML = this.products.map((p) => `<tr>
            <td>${escapeHtml(p.name)}</td><td>${formatCurrency(p.price)}</td><td>${p.quantity}</td>
            <td><input aria-label="Số lượng ${escapeHtml(p.name)}" type="number" min="0" max="${p.quantity}" value="${this.cart.get(String(p.id)) || 0}" data-counter-quantity="${p.id}"></td>
        </tr>`).join("") || '<tr><td colspan="4">Không có đồ uống còn hàng.</td></tr>';
        this.renderCart();
    }

    renderCart() {
        const cart = this.container.querySelector("[data-counter-cart]");
        const items = this.products.filter((p) => (this.cart.get(String(p.id)) || 0) > 0);
        cart.innerHTML = items.length ? items.map((p) => {
            const quantity = this.cart.get(String(p.id));
            return `<p>${escapeHtml(p.name)} × ${quantity} — ${formatCurrency(p.price * quantity)}</p>`;
        }).join("") : "<p>Chưa chọn đồ uống.</p>";
        const total = items.reduce((sum, p) => sum + p.price * this.cart.get(String(p.id)), 0);
        this.container.querySelector("[data-counter-total]").textContent = formatCurrency(total);
    }

    handleChange(event) {
        const input = event.target.closest("[data-counter-quantity]");
        if (!input) return;
        const id = String(input.dataset.counterQuantity);
        const product = this.products.find((p) => String(p.id) === id);
        const quantity = Number(input.value);
        if (!product || !Number.isInteger(quantity) || quantity < 0 || quantity > product.quantity || quantity > 99) {
            input.value = String(this.cart.get(id) || 0);
            return;
        }
        if (quantity === 0) this.cart.delete(id);
        else this.cart.set(id, quantity);
        this.renderCart();
    }

    async handleClick(event) {
        if (!event.target.closest("[data-counter-refresh]")) return;
        await this.loadProducts();
    }

    async handleSubmit(event) {
        if (!event.target.matches("[data-counter-form]")) return;
        event.preventDefault();
        if (this.busy) return;
        const form = event.target;
        const items = [...this.cart.entries()].map(([id, quantity]) => ({ id: Number(id), quantity }));
        if (!items.length) {
            this.setFeedback("Vui lòng chọn ít nhất một đồ uống.", true);
            return;
        }
        this.busy = true;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        this.setFeedback("Đang tạo đơn và cập nhật tồn kho...");
        try {
            const result = await this.onCreateOrder({
                customerName: form.elements.customerName.value.trim(),
                customerPhone: form.elements.customerPhone.value.trim(),
                customerAddress: form.elements.customerAddress.value.trim(),
                paymentMethod: form.elements.paymentMethod.value,
                items
            });
            this.cart.clear();
            form.reset();
            this.setFeedback(`Đã tạo đơn ${result.order_code} — ${formatCurrency(result.total_amount)}. Đơn đang chờ xác nhận và chưa được ghi nhận là đã thanh toán.`);
            await this.loadProducts();
            await this.onCreated();
        } catch (error) {
            this.setFeedback(error.message || "Không thể tạo đơn hàng.", true);
        } finally {
            this.busy = false;
            button.disabled = false;
        }
    }

    setFeedback(message, isError = false) {
        const node = this.container.querySelector("[data-counter-feedback]");
        node.textContent = message;
        node.className = isError ? "app-error" : "";
    }
}
