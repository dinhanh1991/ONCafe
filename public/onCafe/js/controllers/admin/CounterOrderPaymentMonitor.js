/**
 * CounterOrderPaymentMonitor
 * Theo dõi trạng thái thanh toán QR cho đơn tại quầy.
 * Không thao tác DOM; thông báo kết quả qua callback.
 */
export class CounterOrderPaymentMonitor {
    constructor({ getOrder, onPaid, onError = (error) => console.error("Không thể kiểm tra xác nhận QR:", error), intervalMs = 3000 }) {
        if (typeof getOrder !== "function") {
            throw new Error("CounterOrderPaymentMonitor cần hàm getOrder.");
        }

        this.getOrder = getOrder;
        this.onPaid = onPaid;
        this.onError = onError;
        this.intervalMs = intervalMs;
        this.timer = null;
        this.order = null;
        this.busy = false;
        this.generation = 0;
    }

    start(order) {
        this.stop();
        if (!order?.id) return;

        this.order = order;
        const generation = this.generation;
        this.timer = window.setInterval(() => {
            if (!document.hidden) void this.check(generation);
        }, this.intervalMs);
    }

    async check(generation = this.generation) {
        if (!this.order || this.busy || generation !== this.generation) return;

        this.busy = true;
        try {
            const latestOrder = await this.getOrder(this.order.id);
            if (generation !== this.generation || latestOrder?.payment_status !== "paid") return;

            const paidOrder = this.order;
            this.stop();
            this.onPaid?.(paidOrder, latestOrder);
        } catch (error) {
            if (generation === this.generation) this.onError(error);
        } finally {
            if (generation === this.generation) this.busy = false;
        }
    }

    stop() {
        this.generation += 1;
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
        this.order = null;
        this.busy = false;
    }
}
