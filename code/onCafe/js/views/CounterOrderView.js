import { formatCurrency } from "../utils/FormatUtils.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export class CounterOrderView {
    constructor(container, { onLoadProducts, onCreateOrder, onCreated, onSimulateQrPayment }) {
        this.container = container;
        this.onLoadProducts = onLoadProducts;
        this.onCreateOrder = onCreateOrder;
        this.onCreated = onCreated;
        this.onSimulateQrPayment = onSimulateQrPayment;
        this.pendingQrOrder = null;
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
        const simulateButton = event.target.closest("[data-qr-simulate-payment]");
        if (simulateButton) {
            await this.simulateQrPayment(simulateButton);
            return;
        }
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
            const paymentMethod = form.elements.paymentMethod.value;
            form.reset();
            await this.loadProducts();
            await this.onCreated();
            if (paymentMethod === "qr") {
                this.pendingQrOrder = result;
                this.renderQrSimulation(result);
                this.setFeedback("Đơn đã tạo. Đây là màn hình QR mô phỏng phục vụ bài tập; chưa có giao dịch thật.");
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
                <p class="eyebrow">THANH TOÁN QR · CHẾ ĐỘ THỬ NGHIỆM</p>
                <h3>Đơn ${escapeHtml(order.order_code || "#" + order.id)}</h3>
                <p>Tổng tiền cần thanh toán</p>
                <strong class="qr-demo-amount">${formatCurrency(order.total_amount)}</strong>
                <p class="qr-demo-warning">QR minh họa, không thể quét để chuyển tiền. Nút bên dưới chỉ giả lập kết quả thanh toán thành công cho bài tập.</p>
                <button class="button button-primary" type="button" data-qr-simulate-payment>Giả lập khách đã chuyển khoản</button>
                <p data-qr-demo-feedback role="status" aria-live="polite"></p>
            </div>
            <div class="qr-demo-code" role="img" aria-label="Hình QR minh họa, không dùng để thanh toán thật">
                <span class="qr-corner qr-corner-top-left"></span><span class="qr-corner qr-corner-top-right"></span>
                <span class="qr-corner qr-corner-bottom-left"></span><span class="qr-demo-pixels"></span>
                <small>DEMO · NOT PAYABLE</small>
            </div>`;
        this.container.querySelector(".counter-order").append(panel);
    }

    removeQrSimulation() {
        this.container.querySelector("[data-qr-demo-panel]")?.remove();
    }

    async simulateQrPayment(button) {
        const order = this.pendingQrOrder;
        if (!order || !order.id || this.busy) {
            this.setFeedback("Không tìm thấy đơn hàng cần mô phỏng thanh toán.", true);
            return;
        }
        this.busy = true;
        button.disabled = true;
        const feedback = this.container.querySelector("[data-qr-demo-feedback]");
        if (feedback) feedback.textContent = "Đang cập nhật trạng thái thanh toán...";
        try {
            await this.onSimulateQrPayment(order.id);
            if (feedback) {
                feedback.textContent = "Mô phỏng thành công: đơn đã được ghi nhận ĐÃ THANH TOÁN. Không có tiền thật được chuyển.";
                feedback.className = "qr-demo-success";
            }
            button.textContent = "Đã mô phỏng thanh toán";
            await this.onCreated();
        } catch (error) {
            if (feedback) {
                feedback.textContent = error.message || "Không thể cập nhật trạng thái thanh toán.";
                feedback.className = "app-error";
            }
            button.disabled = false;
        } finally {
            this.busy = false;
        }
    }

    setFeedback(message, isError = false) {
        const node = this.container.querySelector("[data-counter-feedback]");
        node.textContent = message;
        node.className = isError ? "app-error" : "";
    }
}
