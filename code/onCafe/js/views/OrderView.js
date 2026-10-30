import { formatCurrency } from "../utils/FormatUtils.js";

const STATUS = {
    pending: "Chờ xác nhận", confirmed: "Đã xác nhận", preparing: "Đang pha chế",
    ready_for_pickup: "Sẵn sàng nhận", delivering: "Đang giao", completed: "Hoàn tất", cancelled: "Đã hủy", rejected: "Đã từ chối"
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

function toLocalDateKey(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export class OrderView {
    constructor(container, { onUpdateStatus, onUpdatePayment, onMarkArrived, onRefresh, readOnly = false }) {
        if (!container) throw new Error("Không tìm thấy vùng hiển thị đơn hàng.");
        this.container = container;
        this.readOnly = readOnly;
        this.onUpdateStatus = onUpdateStatus;
        this.onUpdatePayment = onUpdatePayment;
        this.onMarkArrived = onMarkArrived;
        this.onRefresh = onRefresh;
        this.orders = [];
        this.filter = "all";
        this.sourceFilter = "all";
        this.paymentFilter = "all";
        this.dateFrom = "";
        this.dateTo = "";
        this.searchTerm = "";
        this.sortBy = "newest";
        this.currentPage = 1;
        this.pageSize = 10;
        this.busy = new Set();
        this.container.addEventListener("click", (event) => this.handleClick(event));
        this.container.addEventListener("input", (event) => {
            if (!event.target.matches("[data-order-search]")) return;
            this.searchTerm = event.target.value;
            this.currentPage = 1;
            this.renderList();
        });
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
                    <label class="visually-hidden" for="order-search">Tìm đơn hàng</label>
                    <input id="order-search" data-order-search type="search" placeholder="Tìm mã đơn, khách hàng, SĐT hoặc món" value="${escapeHtml(this.searchTerm)}">
                    <label class="visually-hidden" for="order-filter">Lọc trạng thái</label>
                    <select id="order-filter" data-order-filter aria-label="Lọc theo trạng thái">
                        <option value="all">Tất cả trạng thái</option><option value="pending">Chờ xác nhận</option>
                        <option value="confirmed">Đã xác nhận</option><option value="preparing">Đang pha chế</option>
                        <option value="ready_for_pickup">Sẵn sàng nhận</option><option value="delivering">Đang giao</option><option value="completed">Hoàn tất</option>
                        <option value="rejected">Đã từ chối</option><option value="cancelled">Đã hủy</option>
                    </select>
                    <select data-order-source aria-label="Lọc nguồn đơn">
                        <option value="all">Tất cả nguồn đơn</option><option value="online">Đơn online</option><option value="counter">Đơn tại quầy</option>
                    </select>
                    <select data-order-payment aria-label="Lọc thanh toán">
                        <option value="all">Mọi thanh toán</option><option value="paid">Đã thanh toán</option>
                        <option value="unpaid">Chưa thanh toán</option><option value="refunded">Đã hoàn tiền</option>
                    </select>
                    <label class="order-date-filter"><span>Từ ngày</span><input type="date" data-order-date-from value="${escapeHtml(this.dateFrom)}"></label>
                    <label class="order-date-filter"><span>Đến ngày</span><input type="date" data-order-date-to value="${escapeHtml(this.dateTo)}"></label>
                    <label class="visually-hidden" for="order-sort">Sắp xếp đơn hàng</label>
                    <select id="order-sort" data-order-sort aria-label="Sắp xếp đơn hàng">
                        <option value="newest">Mới nhất</option>
                        <option value="oldest">Cũ nhất</option>
                        <option value="total-desc">Tổng tiền cao đến thấp</option>
                        <option value="total-asc">Tổng tiền thấp đến cao</option>
                    </select>
                    <button class="button button-small" type="button" data-order-clear-filters>Làm mới bộ lọc</button>
                </div>
                <div class="order-list-summary" data-order-list-summary aria-live="polite"></div>
                <p class="order-feedback" data-order-feedback role="status" aria-live="polite"></p>
                <div class="table-scroll"><table class="product-table order-table">
                    <thead><tr><th>Mã đơn / Loại đơn / Thời gian</th><th>Khách hàng / Nhận hàng</th><th>Chi tiết món / Tổng tiền</th><th>Trạng thái đơn</th><th>Thanh toán</th><th>${this.readOnly ? "Thông tin" : "Thao tác"}</th></tr></thead>
                    <tbody data-order-list></tbody>
                </table></div>
                <nav class="product-pagination" data-order-pagination aria-label="Phân trang đơn hàng"></nav>
            </section>`;
        this.container.querySelector("[data-order-filter]").value = this.filter;
        this.container.querySelector("[data-order-source]").value = this.sourceFilter;
        this.container.querySelector("[data-order-payment]").value = this.paymentFilter;
        this.container.querySelector("[data-order-sort]").value = this.sortBy;
        this.renderList();
        return this;
    }

    getFilteredOrders() {
        const term = this.searchTerm.trim().toLocaleLowerCase("vi");
        const orders = this.orders.filter((order) => {
            const searchable = [
                order.order_code,
                order.id,
                order.customer_name,
                order.customer_phone,
                ...(Array.isArray(order.items) ? order.items.map((item) => item.product_name) : [])
            ].join(" ").toLocaleLowerCase("vi");
            const orderDate = toLocalDateKey(order.created_at);
            const matchesStatus = this.filter === "all" || order.status === this.filter;
            const matchesSource = this.sourceFilter === "all" ||
                (this.sourceFilter === "online" ? order.order_source === "online" : order.order_source !== "online");
            const matchesPayment = this.paymentFilter === "all" || order.payment_status === this.paymentFilter;
            const matchesDateFrom = !this.dateFrom || (orderDate && orderDate >= this.dateFrom);
            const matchesDateTo = !this.dateTo || (orderDate && orderDate <= this.dateTo);
            return matchesStatus && matchesSource && matchesPayment && matchesDateFrom && matchesDateTo && searchable.includes(term);
        });
        orders.sort((first, second) => {
            if (this.sortBy.startsWith("total-")) {
                const difference = (Number(first.total_amount) || 0) - (Number(second.total_amount) || 0);
                return this.sortBy === "total-desc" ? -difference : difference;
            }
            const firstDate = new Date(first.created_at).getTime() || 0;
            const secondDate = new Date(second.created_at).getTime() || 0;
            return this.sortBy === "oldest" ? firstDate - secondDate : secondDate - firstDate;
        });
        return orders;
    }

    renderList() {
        const list = this.container.querySelector("[data-order-list]");
        if (!list) return;
        const orders = this.getFilteredOrders();
        this.container.querySelector("[data-order-count]").textContent = `${orders.length} đơn hàng phù hợp`;
        const summary = this.container.querySelector("[data-order-list-summary]");
        if (summary) {
            const totalAmount = orders.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
            const paidAmount = orders.filter((item) => item.payment_status === "paid")
                .reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
            summary.innerHTML = `<span><strong>${orders.length}</strong> đơn phù hợp</span><span>Tổng giá trị đơn: <strong>${formatCurrency(totalAmount)}</strong></span><span>Đã thanh toán: <strong>${formatCurrency(paidAmount)}</strong></span>`;
        }
        const pagination = this.container.querySelector("[data-order-pagination]");
        const totalPages = Math.max(1, Math.ceil(orders.length / this.pageSize));
        this.currentPage = Math.min(this.currentPage, totalPages);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const pageOrders = orders.slice(startIndex, startIndex + this.pageSize);

        if (!orders.length) {
            list.innerHTML = '<tr><td class="empty-state" colspan="6">Không tìm thấy đơn hàng phù hợp. Hãy thử thay đổi từ khóa hoặc bộ lọc.</td></tr>';
            pagination.innerHTML = "";
            return;
        }

        pagination.innerHTML = `<span>Trang ${this.currentPage} / ${totalPages} · ${orders.length} đơn hàng · 10 đơn/trang</span>
            <div class="pagination-actions">
                <button class="button button-small" type="button" data-order-page="${this.currentPage - 1}" ${this.currentPage === 1 ? "disabled" : ""}>Trước</button>
                <button class="button button-small" type="button" data-order-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? "disabled" : ""}>Sau</button>
            </div>`;

        list.innerHTML = pageOrders.map((order) => {
            const itemRows = (order.items || []).map((item) =>
                `<div>${escapeHtml(item.product_name)} × ${escapeHtml(item.quantity)} <small>(${formatCurrency(Number(item.subtotal) || 0)})</small></div>`
            ).join("") || "Không có chi tiết món";
            const items = `<details class="order-detail"><summary>Xem ${(order.items || []).length} món</summary><div class="order-detail-items">${itemRows}</div><p>Phí giao hàng: ${formatCurrency(Number(order.delivery_fee) || 0)}</p></details>`;
            const note = order.fulfillment_method === "delivery" && order.customer_address
                ? `<p class="order-address"><strong>Địa chỉ giao:</strong> ${escapeHtml(order.customer_address)}</p>` : "";
            const arrivalNote = order.delivery_arrived_at
                ? `<p class="order-address"><strong>Đã thông báo khách lúc:</strong> ${escapeHtml(formatDate(order.delivery_arrived_at))}</p>`
                : "";
            const sourceLabel = order.order_source === "online" ? "Đơn online" : "Tại quầy";
            const fulfillmentLabel = order.fulfillment_method === "delivery" ? "Giao tận nhà" : "Nhận tại cửa hàng";
            const actions = this.readOnly ? "" : this.getActions(order).map(([status, label, style]) =>
                `<button class="button button-small ${style || ""}" type="button" data-order-action="${status}" data-order-id="${escapeHtml(order.id)}" ${this.busy.has(String(order.id)) ? "disabled" : ""}>${label}</button>`
            ).join("");
            const paymentAction = order.payment_status === "paid"
                ? `<span class="status status-active">${order.payment_method === "qr" ? "Đã thanh toán QR" : "Đã thanh toán"}</span>`
                : order.payment_status === "refunded"
                    ? `<span class="status status-inactive">Đã hoàn tiền</span>`
                    : `<span class="status status-pending">${order.payment_method === "qr" ? "Chờ khách xác nhận QR" : "Chưa thanh toán"}</span>`;
            const extraActions = `${paymentAction}<button class="button button-small" type="button" data-print-order="${escapeHtml(order.id)}">In hóa đơn</button>`;
            return `<tr>
                <td><strong>${escapeHtml(order.order_code || "#" + order.id)}</strong><br><span class="order-source-label ${order.order_source === "online" ? "is-online" : "is-counter"}">${sourceLabel}</span><br><small>${escapeHtml(formatDate(order.created_at))}</small></td>
                <td><strong>${escapeHtml(order.customer_name || "Khách hàng")}</strong><br><small>${escapeHtml(order.customer_phone || "Chưa có SĐT")}</small><br><span class="order-fulfillment-label">${fulfillmentLabel}</span>${note}${arrivalNote}</td>
                <td><div class="order-item-summary">${items}</div><strong>${formatCurrency(Number(order.total_amount) || 0)}</strong></td>
                <td><span class="status ${this.statusClass(order.status)}">${escapeHtml(STATUS[order.status] || order.status || "Không rõ")}</span></td>
                <td>${escapeHtml(PAYMENT[order.payment_method] || order.payment_method || "—")}<br><small>${escapeHtml(PAYMENT_STATUS[order.payment_status] || order.payment_status || "—")}</small></td>
                <td class="row-actions order-actions">${actions || "<span>Không có thao tác trạng thái</span>"}${extraActions}</td>
            </tr>`;
        }).join("");
    }

    getActions(order) {
        // Chỉ cho phép chuyển trạng thái theo đúng quy trình xử lý đơn hàng.
        if (order.status === "pending") return [
            ["confirmed", "Xác nhận", "button-primary"],
            ["rejected", "Từ chối", "button-danger"]
        ];
        if (order.status === "confirmed") return [["preparing", "Bắt đầu pha chế", "button-primary"]];
        if (order.status === "preparing") {
            if (order.order_source === "online" && order.fulfillment_method === "pickup") {
                return [["ready_for_pickup", "Sẵn sàng nhận", "button-primary"]];
            }
            return [["delivering", order.order_source === "online" ? "Bắt đầu giao" : "Chuyển bước", "button-primary"]];
        }
        if (order.status === "ready_for_pickup") return [["completed", "Đã giao khách", "button-primary"]];
        if (order.status === "delivering") {
            if (order.order_source === "online" && order.fulfillment_method === "delivery") {
                return order.delivery_arrived_at
                    ? [["completed", "Xác nhận đã giao", "button-primary"]]
                    : [["mark_arrived", "Đã đến nơi", "button-primary"]];
            }
            return [["completed", "Hoàn tất đơn", "button-primary"]];
        }
        // Đơn hoàn tất, bị từ chối hoặc đã hủy không còn thao tác.
        return [];
    }

    statusClass(status) {
        if (status === "completed") return "status-active";
        if (["cancelled", "rejected"].includes(status)) return "status-inactive";
        return "status-pending";
    }

    async handleClick(event) {
        if (this.readOnly && event.target instanceof Element &&
            event.target.closest("[data-order-action], [data-payment-action]")) return;
        const pageButton = event.target instanceof Element
            ? event.target.closest("button[data-order-page]")
            : null;
        if (pageButton && this.container.contains(pageButton)) {
            event.preventDefault();
            const requestedPage = Number.parseInt(pageButton.dataset.orderPage, 10);
            const filteredOrders = this.getFilteredOrders();
            const totalPages = Math.max(1, Math.ceil(filteredOrders.length / this.pageSize));
            if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages) {
                this.currentPage = requestedPage;
                this.renderList();
            }
            return;
        }
        const clearFiltersButton = event.target.closest("[data-order-clear-filters]");
        if (clearFiltersButton && this.container.contains(clearFiltersButton)) {
            this.filter = "all";
            this.sourceFilter = "all";
            this.paymentFilter = "all";
            this.dateFrom = "";
            this.dateTo = "";
            this.searchTerm = "";
            this.sortBy = "newest";
            this.currentPage = 1;
            const search = this.container.querySelector("[data-order-search]");
            if (search) search.value = "";
            this.container.querySelector("[data-order-filter]").value = this.filter;
            this.container.querySelector("[data-order-source]").value = this.sourceFilter;
            this.container.querySelector("[data-order-payment]").value = this.paymentFilter;
            this.container.querySelector("[data-order-date-from]").value = "";
            this.container.querySelector("[data-order-date-to]").value = "";
            this.container.querySelector("[data-order-sort]").value = this.sortBy;
            this.setFeedback("Đã xóa toàn bộ bộ lọc.");
            this.renderList();
            return;
        }
        const printButton = event.target.closest("[data-print-order]");
        if (printButton && this.container.contains(printButton)) {
            const order = this.orders.find((item) => String(item.id) === String(printButton.dataset.printOrder));
            if (order) this.printOrder(order);
            return;
        }
        const paymentButton = event.target.closest("[data-payment-action]");
        if (paymentButton && this.container.contains(paymentButton)) {
            const order = this.orders.find((item) => String(item.id) === String(paymentButton.dataset.orderId));
            if (!order || this.busy.has(String(order.id))) return;
            const nextStatus = paymentButton.dataset.paymentAction;
            const confirmed = await this.showConfirmDialog({
                title: nextStatus === "paid" ? "Xác nhận đã nhận tiền" : "Điều chỉnh trạng thái thanh toán",
                message: nextStatus === "paid"
                    ? `Xác nhận đã thực nhận thanh toán cho đơn ${order.order_code || "#" + order.id}? Với QR, chỉ xác nhận sau khi kiểm tra giao dịch.`
                    : `Chuyển đơn ${order.order_code || "#" + order.id} về trạng thái chưa thanh toán?`,
                confirmText: nextStatus === "paid" ? "Đã nhận tiền" : "Chưa thanh toán",
                danger: nextStatus === "unpaid"
            });
            if (!confirmed) return;
            this.busy.add(String(order.id));
            this.renderList();
            try {
                await this.onUpdatePayment(order.id, nextStatus);
                this.setFeedback("Đã cập nhật trạng thái thanh toán.");
                await this.refresh();
            } catch (error) {
                this.setFeedback(error.message || "Không thể cập nhật thanh toán.", true);
            } finally {
                this.busy.delete(String(order.id));
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
        const label = orderAction === "mark_arrived" ? "Đã đến nơi" : (STATUS[orderAction] || orderAction);
        const confirmed = await this.showConfirmDialog({
            title: `Xác nhận ${label.toLowerCase()}`,
            message: `Bạn có chắc muốn chuyển đơn ${order.order_code || "#" + order.id} sang trạng thái "${label}" không?`,
            confirmText: label,
            danger: orderAction === "rejected"
        });
        if (!confirmed) return;

        this.busy.add(String(orderId));
        this.renderList();
        this.setFeedback("Đang cập nhật trạng thái đơn hàng...");
        try {
            if (orderAction === "mark_arrived") {
                await this.onMarkArrived(orderId);
                this.setFeedback("Đã thông báo khách hàng. Nếu đơn vẫn đang giao, hệ thống sẽ tự động hoàn tất sau 30 phút.");
            } else {
                await this.onUpdateStatus(orderId, orderAction);
                this.setFeedback("Cập nhật trạng thái đơn hàng thành công.");
            }
            await this.refresh();
        } catch (error) {
            console.error("Cập nhật đơn hàng thất bại:", error);
            this.setFeedback(error.message || "Không thể cập nhật đơn hàng.", true);
        } finally {
            this.busy.delete(String(orderId));
            this.renderList();
        }
    }



    printOrder(order) {
        const printWindow = window.open("", "_blank", "width=420,height=720");
        if (!printWindow) {
            this.setFeedback("Trình duyệt đã chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.", true);
            return;
        }
        const items = (order.items || []).map((item) => `
            <tr><td>${escapeHtml(item.product_name)} × ${escapeHtml(item.quantity)}</td><td>${formatCurrency(Number(item.subtotal) || 0)}</td></tr>`
        ).join("");
        printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hóa đơn ${escapeHtml(order.order_code)}</title>
            <style>body{font:14px Arial,sans-serif;max-width:360px;margin:24px auto;color:#222}h1,p{text-align:center}table{width:100%;border-collapse:collapse;margin:18px 0}td{padding:7px 0;border-bottom:1px dashed #ccc}td:last-child{text-align:right}.total{font-size:18px;font-weight:bold;text-align:right}.muted{color:#555;font-size:12px}</style>
            </head><body><h1>ONCafe</h1><p>HÓA ĐƠN BÁN HÀNG</p><p class="muted">${escapeHtml(order.order_code || "#" + order.id)}<br>${escapeHtml(formatDate(order.created_at))}</p>
            <p>Khách hàng: ${escapeHtml(order.customer_name || "Khách lẻ")}<br>Điện thoại: ${escapeHtml(order.customer_phone || "—")}<br>Nhận hàng: ${escapeHtml(order.fulfillment_method === "delivery" ? "Giao tận nhà" : "Nhận tại cửa hàng")}</p>
            <table><tbody>${items}</tbody></table><p>Phí giao hàng: ${formatCurrency(Number(order.delivery_fee) || 0)}</p><p class="total">Tổng: ${formatCurrency(Number(order.total_amount) || 0)}</p>
            <p>Thanh toán: ${escapeHtml(PAYMENT[order.payment_method] || order.payment_method || "—")}<br>Trạng thái: ${escapeHtml(PAYMENT_STATUS[order.payment_status] || order.payment_status || "—")}</p>
            <p>Cảm ơn quý khách!</p><script>window.onload=()=>window.print();<\/script></body></html>`);
        printWindow.document.close();
    }

    showConfirmDialog({ title, message, confirmText, danger = false }) {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "oncafe-dialog-backdrop";
            overlay.innerHTML = `
                <section class="oncafe-dialog" role="dialog" aria-modal="true" aria-labelledby="oncafe-dialog-title" aria-describedby="oncafe-dialog-message">
                    <div class="oncafe-dialog-icon" aria-hidden="true">${danger ? "!" : "?"}</div>
                    <h3 id="oncafe-dialog-title">${escapeHtml(title)}</h3>
                    <p id="oncafe-dialog-message">${escapeHtml(message)}</p>
                    <div class="oncafe-dialog-actions">
                        <button type="button" class="button button-small" data-dialog-cancel>Hủy</button>
                        <button type="button" class="button button-small ${danger ? "button-danger" : "button-primary"}" data-dialog-confirm>${escapeHtml(confirmText)}</button>
                    </div>
                </section>`;
            document.body.append(overlay);

            const finish = (value) => {
                overlay.remove();
                document.removeEventListener("keydown", handleKeydown);
                resolve(value);
            };
            const handleKeydown = (event) => {
                if (event.key === "Escape") finish(false);
            };
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay || event.target.closest("[data-dialog-cancel]")) finish(false);
                if (event.target.closest("[data-dialog-confirm]")) finish(true);
            });
            document.addEventListener("keydown", handleKeydown);
            overlay.querySelector("[data-dialog-confirm]").focus();
        });
    }

    async refresh() {
        const activeElement = document.activeElement;
        const focusAttributes = [
            "data-order-search",
            "data-order-filter",
            "data-order-source",
            "data-order-payment",
            "data-order-date-from",
            "data-order-date-to",
            "data-order-sort"
        ];
        const focusedAttribute = focusAttributes.find((attribute) =>
            activeElement?.hasAttribute?.(attribute) && this.container.contains(activeElement)
        );
        const selectionStart = focusedAttribute === "data-order-search" ? activeElement.selectionStart : null;
        const selectionEnd = focusedAttribute === "data-order-search" ? activeElement.selectionEnd : null;

        try {
            const orders = await this.onRefresh();
            this.render(orders);
            this.setFeedback("");

            if (focusedAttribute) {
                const selector = `[${focusedAttribute}]`;
                const focusedControl = this.container.querySelector(selector);
                focusedControl?.focus({ preventScroll: true });
                if (focusedAttribute === "data-order-search" &&
                    selectionStart !== null && selectionEnd !== null) {
                    focusedControl?.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        } catch (error) {
            console.error("Tải đơn hàng thất bại:", error);
            this.setFeedback(error.message || "Không thể tải đơn hàng.", true);
        }
    }

    handleChange(event) {
        if (event.target.matches("[data-order-filter]")) {
            this.filter = event.target.value;
        } else if (event.target.matches("[data-order-source]")) {
            this.sourceFilter = event.target.value;
        } else if (event.target.matches("[data-order-payment]")) {
            this.paymentFilter = event.target.value;
        } else if (event.target.matches("[data-order-date-from]")) {
            this.dateFrom = event.target.value;
        } else if (event.target.matches("[data-order-date-to]")) {
            this.dateTo = event.target.value;
        } else if (event.target.matches("[data-order-sort]")) {
            this.sortBy = event.target.value;
        } else {
            return;
        }
        if (this.dateFrom && this.dateTo && this.dateFrom > this.dateTo) {
            this.setFeedback("Ngày bắt đầu không được sau ngày kết thúc.", true);
            return;
        }
        this.setFeedback("");
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