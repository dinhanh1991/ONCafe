import { formatCurrency } from "../utils/FormatUtils.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export class CounterOrderView {
    constructor(container, { onLoadProducts, onCreateOrder, onCreated, onCreateQrConfirmation, onCheckQrPayment, onQrPaymentConfirmed }) {
        this.container = container;
        this.onLoadProducts = onLoadProducts;
        this.onCreateOrder = onCreateOrder;
        this.onCreated = onCreated;
        this.onCreateQrConfirmation = onCreateQrConfirmation;
        this.onCheckQrPayment = onCheckQrPayment;
        this.onQrPaymentConfirmed = onQrPaymentConfirmed;
        this.qrPaymentTimer = null;
        this.pendingQrOrder = null;
        this.products = [];
        this.cart = new Map();
        this.busy = false;
        this.container.addEventListener("submit", (event) => void this.handleSubmit(event));
        this.container.addEventListener("change", (event) => this.handleChange(event));
        this.container.addEventListener("click", (event) => this.handleClick(event));
    }

    async render() {
        this.stopWatchingQrPayment();
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
        if (event.target.closest("[data-counter-refresh]")) {
            await this.loadProducts();
            return;
        }

        if (event.target.closest("[data-qr-retry]")) {
            const order = this.pendingQrOrder;
            if (!order || this.busy) return;

            const button = this.container.querySelector("[data-qr-retry]");
            if (button) button.disabled = true;
            try {
                await this.createQrForOrder(order);
                this.watchQrPayment(order);
                this.setFeedback(`Đã tạo lại mã QR cho đơn ${order.order_code || "#" + order.id}.`);
            } catch (error) {
                this.setFeedback(
                    `Đơn ${order.order_code || "#" + order.id} đã được tạo nhưng chưa có mã QR. ${error.message || "Vui lòng thử tạo lại mã QR."}`,
                    true
                );
            } finally {
                if (button?.isConnected) button.disabled = false;
            }
        }
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
            const paymentMethod = form.elements.paymentMethod.value;
            form.reset();
            await this.loadProducts();
            await this.onCreated();
            if (paymentMethod === "qr") {
                this.pendingQrOrder = result;
                this.renderQrSimulation(result);
                try {
                    await this.createQrForOrder(result);
                    this.watchQrPayment(result);
                } catch (error) {
                    this.setFeedback(
                        `Đơn ${result.order_code || "#" + result.id} đã được tạo nhưng chưa tạo được mã QR. Không tạo đơn mới; hãy thử tạo lại mã QR bên dưới. ${error.message || ""}`,
                        true
                    );
                }
            } else {
                this.pendingQrOrder = null;
                this.removeQrSimulation();
                this.setFeedback(`Đã tạo đơn ${result.order_code} — ${formatCurrency(result.total_amount)}. Đơn đang chờ xác nhận; hãy xác nhận thu tiền tại mục Quản lý đơn hàng sau khi nhận tiền mặt.`);
            }
        } catch (error) {
            this.setFeedback(error.message || "Không thể tạo đơn hàng.", true);
        } finally {
            this.busy = false;
            button.disabled = false;
        }
    }


    renderQrSimulation(order) {
        this.removeQrSimulation();
        const panel = document.createElement("section");
        panel.className = "qr-demo-panel";
        panel.dataset.qrDemoPanel = "";
        panel.innerHTML = `
            <div class="qr-demo-copy">
                <p class="eyebrow">THANH TOÁN QR</p>
                <h3>Đơn ${escapeHtml(order.order_code || "#" + order.id)}</h3>
                <p>Tổng tiền cần thanh toán</p>
                <strong class="qr-demo-amount">${formatCurrency(order.total_amount)}</strong>
                <p class="qr-demo-warning">Đây là xác nhận nội bộ, chưa kiểm tra giao dịch ngân hàng thực tế. Khách quét mã và xác nhận trên iPhone.</p>
                <p data-qr-demo-feedback role="status" aria-live="polite">Đang tạo liên kết xác nhận...</p>
                <button class="button button-primary" type="button" data-qr-retry hidden>Tạo lại mã QR</button>
            </div>
            <div class="qr-demo-code">
                <img class="qr-demo-image" data-qr-image alt="Mã QR mở trang xác nhận thanh toán trên điện thoại" />
                <small>QUÉT QR ĐỂ XÁC NHẬN</small>
                <p><a data-qr-open target="_blank" rel="noopener">Mở trang xác nhận</a></p>
                <small data-qr-expiry></small>
            </div>`;
        this.container.querySelector(".counter-order").append(panel);
    }

    removeQrSimulation() {
        this.container.querySelector("[data-qr-demo-panel]")?.remove();
    }

    async createQrForOrder(order) {
        const feedback = this.container.querySelector('[data-qr-demo-feedback]');
        try {
            const result = await this.onCreateQrConfirmation(order.id);
            const confirmUrl = new URL('./pages/qr-confirm.html', window.location.href);
            confirmUrl.searchParams.set('token', result.token);
            const qrModule = await import('https://esm.sh/qrcode@1.5.4');
            const QRCode = qrModule.default || qrModule;
            this.container.querySelector('[data-qr-image]').src = await QRCode.toDataURL(confirmUrl.href, { width: 220, margin: 2 });
            const openLink = this.container.querySelector('[data-qr-open]');
            openLink.href = confirmUrl.href;
            this.container.querySelector('[data-qr-expiry]').textContent = 'Mã có hiệu lực đến ' + new Date(result.expires_at).toLocaleTimeString('vi-VN');
            if (feedback) feedback.textContent = 'Khách quét mã bằng iPhone để mở trang xác nhận.';
            const retryButton = this.container.querySelector("[data-qr-retry]");
            if (retryButton) retryButton.hidden = true;
        } catch (error) {
            const retryButton = this.container.querySelector("[data-qr-retry]");
            if (retryButton) retryButton.hidden = false;
            if (feedback) {
                feedback.textContent = error.message || "Không thể tạo mã QR.";
                feedback.className = "app-error";
            }
            throw error;
        }
    }
    watchQrPayment(order) {
        this.stopWatchingQrPayment();
        if (!order?.id || typeof this.onCheckQrPayment !== "function") return;

        this.qrPaymentTimer = window.setInterval(async () => {
            try {
                const latestOrder = await this.onCheckQrPayment(order.id);
                if (latestOrder?.payment_status !== "paid") return;

                this.stopWatchingQrPayment();
                const message = `Khách đã xác nhận thanh toán thành công cho đơn ${order.order_code || "#" + order.id}.`;
                this.setFeedback(message);
                const feedback = this.container.querySelector("[data-qr-demo-feedback]");
                if (feedback) {
                    feedback.textContent = "✓ ĐÃ XÁC NHẬN THANH TOÁN THÀNH CÔNG";
                    feedback.className = "app-success";
                }
                const panel = this.container.querySelector("[data-qr-demo-panel]");
                if (panel) panel.classList.add("qr-payment-confirmed");
                this.showQrPaymentSuccess(order);
            } catch (error) {
                console.error("Không thể kiểm tra xác nhận QR:", error);
            }
        }, 3000);
    }

    showQrPaymentSuccess(order) {
        const overlay = document.createElement("div");
        overlay.className = "oncafe-dialog-backdrop";
        overlay.innerHTML = `
            <section class="oncafe-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-payment-success-title">
                <div class="oncafe-dialog-icon" aria-hidden="true">✓</div>
                <h3 id="qr-payment-success-title">Thanh toán đã được xác nhận</h3>
                <p>Đơn ${escapeHtml(order.order_code || "#" + order.id)} đã được khách xác nhận.</p>
                <div class="oncafe-dialog-actions">
                    <button type="button" class="button button-primary" data-qr-success-ok>OK</button>
                </div>
            </section>`;
        document.body.append(overlay);
        const okButton = overlay.querySelector("[data-qr-success-ok]");
        okButton.addEventListener("click", () => {
            overlay.remove();
            if (typeof this.onQrPaymentConfirmed === "function") {
                this.onQrPaymentConfirmed();
            }
        });
        okButton.focus();
    }

    stopWatchingQrPayment() {
        if (this.qrPaymentTimer) {
            window.clearInterval(this.qrPaymentTimer);
            this.qrPaymentTimer = null;
        }
    }

    setFeedback(message, isError = false) {
        const node = this.container.querySelector("[data-counter-feedback]");
        node.textContent = message;
        node.className = isError ? "app-error" : "";
    }
}
