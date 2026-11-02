let activeQrOrderDialogClose = null;

export function showPaymentConfirmedPopup(order, currencyFormatter) {
    activeQrOrderDialogClose?.();
    if (document.querySelector(".payment-success-backdrop")) return;

    const overlay = document.createElement("div");
    overlay.className = "payment-success-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "payment-success-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "menuPaymentSuccessTitle");

    const icon = document.createElement("div");
    icon.className = "payment-success-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✓";

    const title = document.createElement("h2");
    title.id = "menuPaymentSuccessTitle";
    title.textContent = "Đặt hàng thành công!";

    const message = document.createElement("p");
    message.textContent = "Cảm ơn quý khách đã đặt hàng tại ONCafe. Đơn " + (order.order_code || "") + " đã được thanh toán thành công.";

    const total = document.createElement("strong");
    total.className = "payment-success-total";
    total.textContent = currencyFormatter.format(Number(order.total_amount) || 0);

    const trackButton = document.createElement("button");
    trackButton.type = "button";
    trackButton.className = "payment-success-button";
    trackButton.textContent = "Theo dõi đơn hàng";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "menu-order-dialog-secondary";
    closeButton.textContent = "Đóng";

    const close = () => {
        overlay.remove();
        document.removeEventListener("keydown", handleKeydown);
    };
    const handleKeydown = (event) => {
        if (event.key === "Escape") close();
    };

    dialog.append(icon, title, message, total, trackButton, closeButton);
    overlay.append(dialog);
    document.body.append(overlay);
    trackButton.addEventListener("click", () => {
        window.location.href = "./my-orders.html";
    });
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", handleKeydown);
    trackButton.focus();
}

export function showOrderSuccessPopup(order, paymentMethod, fulfillmentMethod, qrInfo, currencyFormatter) {
    const overlay = document.createElement("div");
    overlay.className = "menu-order-dialog-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "menu-order-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "menu-order-dialog-title");
    dialog.setAttribute("aria-describedby", "menu-order-dialog-message");

    const icon = document.createElement("div");
    icon.className = "menu-order-dialog-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = qrInfo?.image ? "QR" : "✓";

    const title = document.createElement("h2");
    title.id = "menu-order-dialog-title";
    title.textContent = qrInfo?.image ? "Xác nhận thanh toán QR" : "Đơn hàng đã được tạo";

    const message = document.createElement("p");
    message.id = "menu-order-dialog-message";
    const orderCode = order.order_code;
    const total = currencyFormatter.format(Number(order.total_amount) || 0);
    const deliveryFee = Number(order.delivery_fee) || (fulfillmentMethod === "delivery" ? 15000 : 0);
    const fulfillmentLabel = fulfillmentMethod === "delivery" ? "Giao tận nhà" : "Nhận tại cửa hàng";
    message.textContent = `Đơn ${orderCode} đã được tạo. Hình thức nhận: ${fulfillmentLabel}. Phí giao hàng: ${currencyFormatter.format(deliveryFee)}. Tổng thanh toán: ${total}. Vui lòng quét mã QR và xác nhận thanh toán trong 10 phút.`;

    let qrPanel = null;
    if (paymentMethod === "qr") {
        qrPanel = document.createElement("div");
        qrPanel.className = "customer-qr-panel";
        const note = document.createElement("p");
        note.textContent = qrInfo?.image
            ? "Quét mã QR để mở trang xác nhận thanh toán. Vui lòng xác nhận trong 10 phút."
            : `Chưa tạo được mã QR: ${qrInfo?.error || "Vui lòng vào Đơn hàng của tôi hoặc liên hệ cửa hàng để được hỗ trợ."}`;
        qrPanel.append(note);
        if (qrInfo?.image) {
            const image = document.createElement("img");
            image.src = qrInfo.image;
            image.alt = "Mã QR xác nhận thanh toán đơn hàng";
            image.width = 200;
            image.height = 200;
            const link = document.createElement("a");
            link.href = qrInfo.url;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = "Mở trang xác nhận thanh toán";
            const expiry = document.createElement("small");
            expiry.dataset.qrExpiry = String(qrInfo.expiresAt);
            expiry.textContent = `Mã có hiệu lực đến ${new Date(qrInfo.expiresAt).toLocaleTimeString("vi-VN")} (tối đa 10 phút).`;
            qrPanel.append(image, link, expiry);
        }
    }

    const trackButton = document.createElement("button");
    trackButton.type = "button";
    trackButton.className = "menu-add-button";
    trackButton.textContent = "Theo dõi đơn hàng";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "menu-order-dialog-secondary";
    closeButton.textContent = "Tiếp tục xem thực đơn";

    dialog.append(icon, title, message);
    if (qrPanel) dialog.append(qrPanel);
    dialog.append(trackButton, closeButton);
    overlay.append(dialog);
    document.body.append(overlay);

    let expiryTimer = null;
    if (paymentMethod === "qr" && qrInfo?.image) {
        const expiresAt = Number(qrInfo.expiresAt);
        const expiry = qrPanel.querySelector("[data-qr-expiry]");
        const updateExpiry = () => {
            const remainingSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = remainingSeconds % 60;
            expiry.textContent = remainingSeconds
                ? `Mã QR hết hạn sau ${minutes}:${String(seconds).padStart(2, "0")}.`
                : "Mã QR đã hết hạn. Hãy tạo mã mới trong mục Đơn hàng của tôi.";
            if (!remainingSeconds) {
                qrPanel.querySelector("img")?.remove();
                qrPanel.querySelector("a")?.remove();
                window.clearInterval(expiryTimer);
            }
        };
        updateExpiry();
        expiryTimer = window.setInterval(updateExpiry, 1000);
    }

    const close = () => {
        overlay.remove();
        if (expiryTimer) window.clearInterval(expiryTimer);
        document.removeEventListener("keydown", handleKeydown);
        if (activeQrOrderDialogClose === close) activeQrOrderDialogClose = null;
    };
    activeQrOrderDialogClose = close;
    const handleKeydown = (event) => {
        if (event.key === "Escape") close();
    };

    closeButton.addEventListener("click", close);
    trackButton.addEventListener("click", () => {
        window.location.href = "./my-orders.html";
    });
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", handleKeydown);
    closeButton.focus();
}
