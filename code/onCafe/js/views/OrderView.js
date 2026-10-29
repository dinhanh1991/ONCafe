import { formatCurrency } from "../utils/FormatUtils.js";

const STATUS = {
    pending: "Chờ xác nhận", confirmed: "Đã xác nhận", preparing: "Đang pha chế",
    delivering: "Đang giao", completed: "Hoàn tất", cancelled: "Đã hủy", rejected: "Đã từ chối"
};
const PAYMENT = { cash: "Tiền mặt", qr: "QR / chuyển khoản", card: "Thẻ" };
const PAYMENT_STATUS = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", refunded: "Đã hoàn tiền" };
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export class OrderView {
    constructor(container, { onUpdateStatus, onRefresh }) {
        if (!container) throw new Error("Không tìm thấy vùng hiển thị đơn hàng.");
        this.container = container;
        this.onUpdateStatus = onUpdateStatus;
        this.onRefresh = onRefresh;
        this.orders = [];
        this.filter = "all";
        this.currentPage = 1;
        this.pageSize = 5;
        this.busy = new Set();
        this.container.addEventListener("click", (event) => this.handleClick(event));
        this.container.addEventListener("change", (event) => this.handleChange(event));
    }

    render(orders) {
        this.orders = Array.isArray(orders) ? orders : [];
        this.container.innerHTML = `
            <section class="order-manager" aria-labelledby="order-heading">
                <header class="product-heading">
                    <div><p class="eyebrow">VẬN HÀNH QUÁN</p><h2 id="order-heading">Quản lý đơn hàng</h2><p data-order-count></p></div>
                    <button class="button button-primary" type="button" data-order-refresh>↻ Tải lại</button>
                </header>
                <div class="order-toolbar">
                    <label for="order-filter">Lọc trạng thái</label>
                    <select id="order-filter" data-order-filter>
                        <option value="all">Tất cả đơn</option><option value="pending">Chờ xác nhận</option>
                        <option value="confirmed">Đã xác nhận</option><option value="preparing">Đang pha chế</option>
                        <option value="delivering">Đang giao</option><option value="completed">Hoàn tất</option>
                        <option value="rejected">Đã từ chối</option><option value="cancelled">Đã hủy</option>
                    </select>
                </div>
                <p class="order-feedback" data-order-feedback role="status" aria-live="polite"></p>
                <div class="table-scroll"><table class="product-table order-table">
                    <thead><tr><th>Mã đơn / Thời gian</th><th>Khách hàng</th><th>Chi tiết món / Tổng tiền</th><th>Trạng thái đơn</th><th>Thanh toán</th><th>Thao tác</th></tr></thead>
                    <tbody data-order-list></tbody>
                </table></div>
                <nav class="product-pagination" data-order-pagination aria-label="Phân trang đơn hàng"></nav>
            </section>`;
        this.renderList();
        return this;
    }

    renderList() {
        const list = this.container.querySelector("[data-order-list]");
        if (!list) return;
        const orders = this.filter === "all" ? this.orders : this.orders.filter((o) => o.status === this.filter);
        this.container.querySelector("[data-order-count]").textContent = `${orders.length} đơn hàng`;
        const pagination = this.container.querySelector("[data-order-pagination]");
        const totalPages = Math.max(1, Math.ceil(orders.length / this.pageSize));
        this.currentPage = Math.min(this.currentPage, totalPages);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const pageOrders = orders.slice(startIndex, startIndex + this.pageSize);

        if (!orders.length) {
            list.innerHTML = '<tr><td class="empty-state" colspan="6">Không có đơn hàng ở trạng thái này.</td></tr>';
            pagination.innerHTML = "";
            return;
        }

        pagination.innerHTML = `<span>Trang ${this.currentPage} / ${totalPages} · ${orders.length} đơn hàng · 5 đơn/trang</span>
            <div class="pagination-actions">
                <button class="button button-small" type="button" data-order-page="${this.currentPage - 1}" ${this.currentPage === 1 ? "disabled" : ""}>Trước</button>
                <button class="button button-small" type="button" data-order-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? "disabled" : ""}>Sau</button>
            </div>`;

        list.innerHTML = pageOrders.map((order) => {
            const items = (order.items || []).map((item) =>
                `<div>${escapeHtml(item.product_name)} × ${escapeHtml(item.quantity)} <small>(${formatCurrency(Number(item.subtotal) || 0)})</small></div>`
            ).join("") || "Không có chi tiết món";
            const note = order.customer_address ? `<p class="order-address"><strong>Địa chỉ / ghi chú:</strong> ${escapeHtml(order.customer_address)}</p>` : "";
            const actions = this.getActions(order).map(([status, label, style]) =>
                `<button class="button button-small ${style || ""}" type="button" data-order-action="${status}" data-order-id="${escapeHtml(order.id)}" ${this.busy.has(String(order.id)) ? "disabled" : ""}>${label}</button>`
            ).join("");
            return `<tr>
                <td><strong>${escapeHtml(order.order_code || "#" + order.id)}</strong><br><small>${escapeHtml(formatDate(order.created_at))}</small></td>
                <td><strong>${escapeHtml(order.customer_name || "Khách hàng")}</strong><br><small>${escapeHtml(order.customer_phone || "Chưa có SĐT")}</small>${note}</td>
                <td><div class="order-item-summary">${items}</div><strong>${formatCurrency(Number(order.total_amount) || 0)}</strong></td>
                <td><span class="status ${this.statusClass(order.status)}">${escapeHtml(STATUS[order.status] || order.status || "Không rõ")}</span></td>
                <td>${escapeHtml(PAYMENT[order.payment_method] || order.payment_method || "—")}<br><small>${escapeHtml(PAYMENT_STATUS[order.payment_status] || order.payment_status || "—")}</small></td>
                <td class="row-actions order-actions">${actions || "<span>Không có thao tác</span>"}</td>
            </tr>`;
        }).join("");
    }

    getActions(order) {
        if (["completed", "cancelled", "rejected"].includes(order.status)) return [];
        if (order.status === "pending") return [
            ["confirmed", "Xác nhận", "button-primary"], ["rejected", "Từ chối", "button-danger"], ["preparing", "Pha chế"]
        ];
        if (order.status === "confirmed") return [["preparing", "Pha chế"], ["delivering", "Đang giao"], ["completed", "Hoàn tất"]];
        if (order.status === "preparing") return [["delivering", "Bắt đầu giao"], ["completed", "Hoàn tất"]];
        if (order.status === "delivering") return [["completed", "Hoàn tất", "button-primary"]];
        return [];
    }

    statusClass(status) {
        if (status === "completed") return "status-active";
        if (["cancelled", "rejected"].includes(status)) return "status-inactive";
        return "status-pending";
    }

    async handleClick(event) {
        const pageButton = event.target instanceof Element
            ? event.target.closest("button[data-order-page]")
            : null;
        if (pageButton && this.container.contains(pageButton)) {
            event.preventDefault();
            const requestedPage = Number.parseInt(pageButton.dataset.orderPage, 10);
            const filteredOrders = this.filter === "all"
                ? this.orders
                : this.orders.filter((order) => order.status === this.filter);
            const totalPages = Math.max(1, Math.ceil(filteredOrders.length / this.pageSize));
            if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages) {
                this.currentPage = requestedPage;
                this.renderList();
            }
            return;
        }
        if (event.target.closest("[data-order-refresh]")) {
            await this.refresh();
            return;
        }
        const button = event.target.closest("[data-order-action]");
        if (!button || !this.container.contains(button)) return;
        const { orderId, orderAction } = button.dataset;
        const order = this.orders.find((item) => String(item.id) === String(orderId));
        if (!order || this.busy.has(String(orderId))) return;
        const label = STATUS[orderAction] || orderAction;
        if (!window.confirm(`Bạn chắc chắn muốn chuyển đơn ${order.order_code || order.id} sang trạng thái "${label}"?`)) return;

        this.busy.add(String(orderId));
        this.renderList();
        this.setFeedback("Đang cập nhật trạng thái đơn hàng...");
        try {
            await this.onUpdateStatus(orderId, orderAction);
            this.setFeedback("Cập nhật trạng thái đơn hàng thành công.");
            await this.refresh();
        } catch (error) {
            console.error("Cập nhật đơn hàng thất bại:", error);
            this.setFeedback(error.message || "Không thể cập nhật đơn hàng.", true);
        } finally {
            this.busy.delete(String(orderId));
            this.renderList();
        }
    }

    async refresh() {
        this.setFeedback("Đang tải danh sách đơn hàng...");
        try {
            const orders = await this.onRefresh();
            this.render(orders);
            this.setFeedback("");
        } catch (error) {
            console.error("Tải đơn hàng thất bại:", error);
            this.setFeedback(error.message || "Không thể tải đơn hàng.", true);
        }
    }

    handleChange(event) {
        if (!event.target.matches("[data-order-filter]")) return;
        this.filter = event.target.value;
        this.currentPage = 1;
        this.renderList();
    }

    setFeedback(message, isError = false) {
        const element = this.container.querySelector("[data-order-feedback]");
        if (!element) return;
        element.textContent = message;
        element.classList.toggle("app-error", isError);
    }
}