/**
 * CustomerPaymentMonitor
 * Theo dõi trạng thái thanh toán của một đơn hàng online.
 * Không trực tiếp thao tác giao diện; kết quả được chuyển qua callback.
 */
export class CustomerPaymentMonitor {
    constructor({
        getPaymentState,
        onPaid,
        onEnded,
        onError = (error) => console.warn("Chưa thể kiểm tra trạng thái thanh toán:", error),
        intervalMs = 5000
    }) {
        if (typeof getPaymentState !== "function") {
            throw new Error("CustomerPaymentMonitor cần hàm getPaymentState.");
        }

        this.getPaymentState = getPaymentState;
        this.onPaid = onPaid;
        this.onEnded = onEnded;
        this.onError = onError;
        this.intervalMs = intervalMs;
        this.timer = null;
        this.orderId = null;
        this.busy = false;
        this.generation = 0;
    }

    start(orderId) {
        this.stop();

        if (!orderId) {
            throw new Error("Mã đơn hàng không hợp lệ.");
        }

        this.orderId = orderId;
        const generation = this.generation;

        this.timer = window.setInterval(() => {
            if (!document.hidden) void this.check(generation);
        }, this.intervalMs);
    }

    async check(generation = this.generation) {
        if (!this.orderId || this.busy || generation !== this.generation) return;

        this.busy = true;
        try {
            const order = await this.getPaymentState(this.orderId);
            if (generation !== this.generation || !order) return;

            if (order.payment_status === "paid") {
                this.stop();
                this.onPaid?.(order);
                return;
            }

            if (["cancelled", "rejected"].includes(order.status)) {
                this.stop();
                this.onEnded?.(order);
            }
        } catch (error) {
            if (generation === this.generation) this.onError?.(error);
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

        this.orderId = null;
        this.busy = false;
    }
}
