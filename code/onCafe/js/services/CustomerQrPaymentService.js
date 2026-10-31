/**
 * Tạo thông tin QR dùng chung cho các luồng thanh toán của khách hàng.
 * Không truy cập Supabase; chỉ xử lý thời hạn, URL xác nhận và ảnh QR.
 */
export class CustomerQrPaymentService {
    async createQrInfo(paymentData, currentPageUrl, width = 220) {
        if (!paymentData?.token) {
            throw new Error("Không nhận được mã xác nhận thanh toán.");
        }

        const serverExpiry = new Date(paymentData.expires_at).getTime();
        if (!Number.isFinite(serverExpiry)) {
            throw new Error("Hệ thống trả về thời hạn mã QR không hợp lệ.");
        }

        const expiresAt = Math.min(serverExpiry, Date.now() + 10 * 60 * 1000);
        const confirmUrl = new URL("./qr-confirm.html", currentPageUrl);
        confirmUrl.searchParams.set("token", paymentData.token);
        confirmUrl.searchParams.set("expires", String(expiresAt));

        const qrModule = await import("https://esm.sh/qrcode@1.5.4");
        const QRCode = qrModule.default || qrModule;

        return {
            url: confirmUrl.href,
            image: await QRCode.toDataURL(confirmUrl.href, { width, margin: 2 }),
            expiresAt
        };
    }
}
