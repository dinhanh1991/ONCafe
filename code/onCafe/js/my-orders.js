import { supabase } from "./config/supabase.js";

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

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" :
        new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
}

async function loadOrders() {
    refreshButton.disabled = true;
    setMessage("Đang tải đơn hàng...");
    try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
            setMessage("Bạn cần đăng nhập để xem đơn hàng của mình.", true);
            list.innerHTML = '<a class="orders-login-link" href="./login.html?redirect=my-orders">Đăng nhập</a>';
            return;
        }

        const { data, error } = await supabase.rpc("oncafe_my_orders");
        if (error) throw error;
        const orders = Array.isArray(data) ? data : [];
        renderOrders(orders);
        setMessage(orders.length ? `Bạn có ${orders.length} đơn hàng.` : "Bạn chưa có đơn hàng online nào.");
    } catch (error) {
        console.error("Không thể tải đơn hàng khách hàng:", error);
        setMessage(error.message || "Không thể tải đơn hàng. Vui lòng thử lại.", true);
    } finally {
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
        const arrivalNotice = order.delivery_arrived_at ? `<p class="delivery-arrival-notice" role="status">ONCafe thông báo: Nhân viên đã đến địa chỉ giao hàng lúc ${escapeHtml(formatDate(order.delivery_arrived_at))}. Vui lòng liên hệ với nhân viên để nhận đơn.</p>` : "";
        const statusClass = ["completed"].includes(order.status) ? "is-complete" :
            ["cancelled", "rejected"].includes(order.status) ? "is-cancelled" : "is-pending";
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
                    <p><span>Thanh toán</span><strong>${escapeHtml(PAYMENT[order.payment_method] || "—")} · ${escapeHtml(PAYMENT_STATUS[order.payment_status] || "—")}</strong></p>
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
        const { data, error } = await supabase.functions.invoke("oncafe-qr-payment", {
            body: { action: "create", order_id: Number(orderId) }
        });
        if (error) throw new Error(data?.error || error.message || "Không thể tạo mã QR.");
        if (!data?.token) throw new Error(data?.error || "Không nhận được mã QR.");

        const url = new URL("./qr-confirm.html", window.location.href);
        url.searchParams.set("token", data.token);
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
        note.textContent = `Mã QR có hiệu lực đến ${new Date(data.expires_at).toLocaleTimeString("vi-VN")}. Đây là xác nhận nội bộ mô phỏng, không phải kết nối ngân hàng.`;
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
    if (!window.confirm("Bạn chắc chắn muốn hủy đơn hàng này? Số lượng sản phẩm đã giữ sẽ được hoàn lại kho.")) return;

    cancelButton.disabled = true;
    cancelButton.textContent = "Đang hủy...";
    try {
        const { error } = await supabase.rpc("oncafe_cancel_my_order", { p_order_id: orderId });
        if (error) throw error;
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
