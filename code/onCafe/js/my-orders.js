import { CustomerOrderRepository } from "./repositories/CustomerOrderRepo.js";
import { CustomerMyOrdersService } from "./services/CustomerMyOrdersService.js";

const customerMyOrdersService = new CustomerMyOrdersService(new CustomerOrderRepository());

const list = document.querySelector("#ordersList");
const message = document.querySelector("#ordersMessage");
const refreshButton = document.querySelector("#refreshOrders");

const STATUS = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    preparing: "Đang pha chế",
    ready_for_pickup: "Sẵn sàng nhận tại cửa hàng",
    delivering: "Đang giao hàng",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
    rejected: "Đã từ chối"
};
const PAYMENT = { cash: "Tiền mặt khi nhận hàng", qr: "Thanh toán QR" };
const PAYMENT_STATUS = { unpaid: "Chưa thanh toán", paid: "Đã thanh toán", refunded: "Đã hoàn tiền" };
const FULFILLMENT = { pickup: "Nhận tại cửa hàng", delivery: "Giao tận nhà" };
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let previousPaymentStates = new Map();
let hasLoadedOrders = false;
let isLoadingOrders = false;
const notifiedPaidOrders = new Set();

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" :
        new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
}

function showPaymentSuccessPopup(order) {
    if (document.querySelector(".payment-success-backdrop")) return;

    const overlay = document.createElement("div");
    overlay.className = "payment-success-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "payment-success-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "paymentSuccessTitle");
    dialog.setAttribute("aria-describedby", "paymentSuccessMessage");

    const icon = document.createElement("div");
    icon.className = "payment-success-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✓";

    const title = document.createElement("h2");
    title.id = "paymentSuccessTitle";
    title.textContent = "Đặt hàng thành công!";

    const detail = document.createElement("p");
    detail.id = "paymentSuccessMessage";
    detail.textContent = `Cảm ơn quý khách đã đặt hàng tại ONCafe. Đơn ${order.order_code || ""} đã được thanh toán thành công.`;

    const total = document.createElement("strong");
    total.className = "payment-success-total";
    total.textContent = currency.format(Number(order.total_amount) || 0);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "payment-success-button";
    closeButton.textContent = "Tuyệt vời";

    const close = () => {
        overlay.remove();
        document.removeEventListener("keydown", onKeydown);
    };
    const onKeydown = (event) => {
        if (event.key === "Escape") close();
    };

    dialog.append(icon, title, detail, total, closeButton);
    overlay.append(dialog);
    document.body.append(overlay);
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", onKeydown);
    closeButton.focus();
}

function showCancelOrderDialog() {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "order-cancel-backdrop";

        const dialog = document.createElement("section");
        dialog.className = "order-cancel-dialog";
        dialog.setAttribute("role", "alertdialog");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", "cancelOrderTitle");
        dialog.setAttribute("aria-describedby", "cancelOrderMessage");

        const icon = document.createElement("div");
        icon.className = "order-cancel-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "!";

        const title = document.createElement("h2");
        title.id = "cancelOrderTitle";
        title.textContent = "Hủy đơn hàng?";

        const detail = document.createElement("p");
        detail.id = "cancelOrderMessage";
        detail.textContent = "Bạn có chắc muốn hủy đơn hàng này không? Số lượng sản phẩm đã giữ sẽ được hoàn lại kho.";

        const actions = document.createElement("div");
        actions.className = "order-cancel-actions";

        const keepButton = document.createElement("button");
        keepButton.type = "button";
        keepButton.className = "order-cancel-keep";
        keepButton.textContent = "Không, giữ đơn";

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "order-cancel-confirm";
        cancelButton.textContent = "Có, hủy đơn";

        actions.append(keepButton, cancelButton);
        dialog.append(icon, title, detail, actions);
        overlay.append(dialog);
        document.body.append(overlay);

        const finish = (confirmed) => {
            overlay.remove();
            document.removeEventListener("keydown", handleKeydown);
            resolve(confirmed);
        };
        const handleKeydown = (event) => {
            if (event.key === "Escape") finish(false);
        };

        keepButton.addEventListener("click", () => finish(false));
        cancelButton.addEventListener("click", () => finish(true));
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) finish(false);
        });
        document.addEventListener("keydown", handleKeydown);
        keepButton.focus();
    });
}

async function loadOrders() {
    if (isLoadingOrders) return;
    isLoadingOrders = true;
    refreshButton.disabled = true;
    if (!hasLoadedOrders) setMessage("Đang tải đơn hàng...");

    try {
        const user = await customerMyOrdersService.getCurrentUser();
        if (!user) {
            setMessage("Bạn cần đăng nhập để xem đơn hàng của mình.", true);
            list.innerHTML = '<a class="orders-login-link" href="../auth/login.html?redirect=my-orders">Đăng nhập</a>';
            return;
        }

        const orders = await customerMyOrdersService.getMyOrders();

        if (hasLoadedOrders) {
            for (const order of orders) {
                const previousStatus = previousPaymentStates.get(String(order.id));
                if (previousStatus === "unpaid" && order.payment_status === "paid" &&
                    order.payment_method === "qr" && !notifiedPaidOrders.has(String(order.id))) {
                    notifiedPaidOrders.add(String(order.id));
                    showPaymentSuccessPopup(order);
                }
            }
        }

        previousPaymentStates = new Map(orders.map((order) => [String(order.id), order.payment_status]));
        hasLoadedOrders = true;
        renderOrders(orders);
        setMessage(orders.length ? `Bạn có ${orders.length} đơn hàng. Trạng thái được tự động cập nhật.` : "Bạn chưa có đơn hàng online nào.");
    } catch (error) {
        console.error("Không thể tải đơn hàng khách hàng:", error);
        setMessage(error.message || "Không thể tải đơn hàng. Vui lòng thử lại.", true);
    } finally {
        isLoadingOrders = false;
        refreshButton.disabled = false;
    }
}

function renderOrders(orders) {
    if (!orders.length) {
        list.innerHTML = '<div class="orders-empty"><h2>Chưa có đơn hàng</h2><p>Hãy chọn đồ uống yêu thích và đặt hàng tại ONCafe.</p><a href="./menu.html">Khám phá thực đơn</a></div>';
        return;
    }

    list.innerHTML = orders.map((order) => {
        const items = (order.items || []).map((item) =>
            `<li><span>${escapeHtml(item.product_name)} × ${escapeHtml(item.quantity)}</span><strong>${currency.format(Number(item.subtotal) || 0)}</strong></li>`
        ).join("");
        const canCancel = order.status === "pending" && order.payment_status === "unpaid";
        const canCreateQr = order.status === "pending" && order.payment_method === "qr" && order.payment_status === "unpaid";
        const deliveryFee = Number(order.delivery_fee) || 0;
        const arrivalNotice = order.delivery_arrived_at ? `<p class="delivery-arrival-notice" role="status">ONCafe thông báo: Nhân viên giao hàng đã đến địa chỉ của bạn lúc ${escapeHtml(formatDate(order.delivery_arrived_at))}.</p>` : "";
        const statusClass = order.status === "completed" ? "is-complete" :
            ["cancelled", "rejected"].includes(order.status) ? "is-cancelled" : "is-pending";
        const paymentClass = order.payment_status === "paid" ? "is-paid" : "is-unpaid";
        return `
            <article class="my-order-card" data-order-id="${escapeHtml(order.id)}">
                <header class="my-order-card-header">
                    <div>
                        <span class="online-order-label">ĐƠN ONLINE</span>
                        <h2>${escapeHtml(order.order_code || "#" + order.id)}</h2>
                        <time>${escapeHtml(formatDate(order.created_at))}</time>
                    </div>
                    <span class="order-status ${statusClass}">${escapeHtml(STATUS[order.status] || order.status)}</span>
                </header>
                <div class="my-order-meta">
                    <p><span>Hình thức nhận</span><strong>${escapeHtml(FULFILLMENT[order.fulfillment_method] || "—")}</strong></p>
                    <p><span>Thanh toán</span><strong class="payment-state ${paymentClass}">${escapeHtml(PAYMENT[order.payment_method] || "—")} · ${escapeHtml(PAYMENT_STATUS[order.payment_status] || "—")}</strong></p>
                    ${order.fulfillment_method === "delivery" ? `<p><span>Địa chỉ giao hàng</span><strong>${escapeHtml(order.customer_address || "—")}</strong></p>` : ""}
                </div>
                ${arrivalNotice}
                <details class="my-order-details">
                    <summary>Chi tiết ${(order.items || []).length} món</summary>
                    <ul>${items}</ul>
                    <p class="order-fee-row"><span>Phí giao hàng</span><strong>${currency.format(deliveryFee)}</strong></p>
                </details>
                <footer class="my-order-footer">
                    <strong class="my-order-total">Tổng cộng: ${currency.format(Number(order.total_amount) || 0)}</strong>
                    <div class="my-order-actions">
                        ${canCreateQr ? `<button type="button" class="orders-action-button" data-create-qr="${escapeHtml(order.id)}">Hiển thị mã QR</button>` : ""}
                        ${canCancel ? `<button type="button" class="orders-cancel-button" data-cancel-order="${escapeHtml(order.id)}">Hủy đơn</button>` : ""}
                    </div>
                </footer>
                <div class="customer-order-qr" data-qr-panel hidden></div>
            </article>`;
    }).join("");
}

async function createQr(orderId, button) {
    button.disabled = true;
    button.textContent = "Đang tạo mã QR...";
    try {
        const data = await customerMyOrdersService.createQrPayment(Number(orderId));
        const serverExpiry = new Date(data.expires_at).getTime();
        if (!Number.isFinite(serverExpiry)) throw new Error("Hệ thống trả về thời hạn mã QR không hợp lệ.");
        const expiresAt = Math.min(serverExpiry, Date.now() + 10 * 60 * 1000);

        const url = new URL("./qr-confirm.html", window.location.href);
        url.searchParams.set("token", data.token);
        url.searchParams.set("expires", String(expiresAt));
        const qrModule = await import("https://esm.sh/qrcode@1.5.4");
        const QRCode = qrModule.default || qrModule;
        const imageUrl = await QRCode.toDataURL(url.href, { width: 210, margin: 2 });
        const card = button.closest(".my-order-card");
        const panel = card.querySelector("[data-qr-panel]");
        panel.hidden = false;
        panel.innerHTML = "";
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = "Mã QR xác nhận thanh toán";
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Mở trang xác nhận thanh toán";
        const note = document.createElement("p");
        note.textContent = `Mã QR có hiệu lực đến ${new Date(expiresAt).toLocaleTimeString("vi-VN")} (tối đa 10 phút).`;
        panel.append(image, link, note);
        button.textContent = "Tạo lại mã QR";
        button.disabled = false;
    } catch (error) {
        setMessage(error.message || "Không thể tạo mã QR.", true);
        button.textContent = "Thử tạo lại mã QR";
        button.disabled = false;
    }
}

list.addEventListener("click", async (event) => {
    const qrButton = event.target.closest("[data-create-qr]");
    if (qrButton) {
        await createQr(qrButton.dataset.createQr, qrButton);
        return;
    }

    const cancelButton = event.target.closest("[data-cancel-order]");
    if (!cancelButton) return;
    const orderId = Number(cancelButton.dataset.cancelOrder);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return;
    if (!await showCancelOrderDialog()) return;

    cancelButton.disabled = true;
    cancelButton.textContent = "Đang hủy...";
    try {
        await customerMyOrdersService.cancelMyOrder(orderId);
        setMessage("Đã hủy đơn hàng và hoàn lại số lượng tồn kho.");
        await loadOrders();
    } catch (error) {
        setMessage(error.message || "Không thể hủy đơn hàng.", true);
        cancelButton.disabled = false;
        cancelButton.textContent = "Hủy đơn";
    }
});

refreshButton.addEventListener("click", () => void loadOrders());
void loadOrders();

const ordersRefreshTimer = window.setInterval(() => {
    if (!document.hidden) void loadOrders();
}, 5000);
window.addEventListener("beforeunload", () => window.clearInterval(ordersRefreshTimer));
