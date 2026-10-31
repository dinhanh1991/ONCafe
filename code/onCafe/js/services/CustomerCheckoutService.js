export class CustomerCheckoutService {
    constructor(orderRepository) {
        if (!orderRepository) throw new Error("CustomerCheckoutService cần CustomerOrderRepository.");
        this.orderRepository = orderRepository;
    }

    async getCurrentUser() {
        return this.orderRepository.getCurrentUser();
    }

    async getCustomerProfile(userId) {
        return this.orderRepository.getCustomerProfile(userId);
    }

    async createOrder(orderDetails) {
        const order = await this.orderRepository.createOrder(orderDetails);
        if (!order?.order_code) {
            throw new Error("Hệ thống chưa trả về mã đơn hàng. Vui lòng kiểm tra mục đơn hàng trước khi đặt lại.");
        }
        return order;
    }

    async createQrInfo(orderId, currentPageUrl) {
        const data = await this.orderRepository.createQrPayment(orderId);
        const serverExpiry = new Date(data.expires_at).getTime();
        if (!Number.isFinite(serverExpiry)) {
            throw new Error("Hệ thống trả về thời hạn mã QR không hợp lệ.");
        }

        const expiresAt = Math.min(serverExpiry, Date.now() + 10 * 60 * 1000);
        const confirmUrl = new URL("./qr-confirm.html", currentPageUrl);
        confirmUrl.searchParams.set("token", data.token);
        confirmUrl.searchParams.set("expires", String(expiresAt));

        const qrModule = await import("https://esm.sh/qrcode@1.5.4");
        const QRCode = qrModule.default || qrModule;

        return {
            url: confirmUrl.href,
            image: await QRCode.toDataURL(confirmUrl.href, { width: 220, margin: 2 }),
            expiresAt
        };
    }

    async getOrderPaymentState(orderId) {
        return this.orderRepository.getOrderPaymentState(orderId);
    }
}
