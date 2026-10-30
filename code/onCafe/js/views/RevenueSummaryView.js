const currencyFormatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
});
const numberFormatter = new Intl.NumberFormat("vi-VN");

function getLocalDateValue() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function formatPeriodLabel(value, period) {
    const [year, month, day] = value.split("-").map(Number);
    if (period === "day") return `Ngày ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    if (period === "month") return `Tháng ${String(month).padStart(2, "0")}/${year}`;
    return `Năm ${year}`;
}

function getPreviousAnchorDate(value, period) {
    const [year, month, day] = value.split("-").map(Number);
    const date = period === "day"
        ? new Date(Date.UTC(year, month - 1, day - 1))
        : period === "month"
            ? new Date(Date.UTC(year, month - 2, 1))
            : new Date(Date.UTC(year - 1, month - 1, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function getComparisonLabel(currentValue, previousValue) {
    const current = Number(currentValue) || 0;
    const previous = Number(previousValue) || 0;
    if (previous === 0) return current === 0 ? "Không phát sinh ở cả hai kỳ" : "Phát sinh mới so với kỳ trước";
    const change = ((current - previous) / previous) * 100;
    const prefix = change > 0 ? "Tăng " : change < 0 ? "Giảm " : "Không đổi ";
    return `${prefix}${Math.abs(change).toFixed(1)}% so với kỳ trước`;
}

export class RevenueSummaryView {
    constructor(container, { onLoad }) {
        if (!container) throw new Error("Không tìm thấy vùng hiển thị tổng hợp doanh thu.");
        this.container = container;
        this.onLoad = onLoad;
        this.period = "day";
        this.anchorDate = getLocalDateValue();
        this.requestId = 0;

        this.container.innerHTML = `
            <section class="revenue-report revenue-summary" aria-labelledby="revenue-summary-heading">
                <header class="revenue-report-heading">
                    <div>
                        <p class="eyebrow">TỔNG HỢP KINH DOANH</p>
                        <h2 id="revenue-summary-heading">Tổng hợp doanh thu</h2>
                        <p data-summary-period-label></p>
                    </div>
                    <button class="button button-primary" type="button" data-summary-refresh>↻ Làm mới</button>
                </header>
                <div class="revenue-report-filters">
                    <label><span>Kiểu tổng hợp</span>
                        <select data-summary-period>
                            <option value="day">Theo ngày</option>
                            <option value="month">Theo tháng</option>
                            <option value="year">Theo năm</option>
                        </select>
                    </label>
                    <label><span>Chọn ngày / tháng / năm</span><input type="date" data-summary-date></label>
                </div>
                <p class="revenue-report-feedback" data-summary-feedback role="status" aria-live="polite"></p>
                <section class="revenue-report-metrics" data-summary-metrics aria-label="Các chỉ số tổng hợp doanh thu">
                    <article class="revenue-report-metric is-primary"><span>Doanh thu thuần</span><strong>—</strong><small data-summary-compare="net_revenue">Đang so sánh...</small></article>
                    <article class="revenue-report-metric"><span>Tổng tiền đã thu</span><strong>—</strong><small data-summary-compare="paid_amount">Đang so sánh...</small></article>
                    <article class="revenue-report-metric"><span>Tổng tiền hoàn</span><strong>—</strong><small data-summary-compare="refunded_amount">Đang so sánh...</small></article>
                    <article class="revenue-report-metric"><span>Đơn đã thanh toán</span><strong>—</strong><small data-summary-compare="paid_orders">Đang so sánh...</small></article>
                </section>
                <section class="revenue-report-card">
                    <div class="revenue-report-section-heading">
                        <div><p class="eyebrow">NGUYÊN TẮC GHI NHẬN</p><h3>Cách tính doanh thu</h3></div>
                    </div>
                    <p class="revenue-report-note">Doanh thu thuần = Tổng tiền đã thu − Tổng tiền hoàn. Đơn chưa thanh toán, đã hủy hoặc bị từ chối không được tính vào doanh thu. Báo cáo chi tiết theo từng giờ, ngày hoặc tháng được xem tại mục Báo cáo doanh thu.</p>
                </section>
            </section>`;

        this.container.querySelector("[data-summary-period]").value = this.period;
        this.container.querySelector("[data-summary-date]").value = this.anchorDate;
        this.container.addEventListener("change", (event) => this.handleChange(event));
        this.container.addEventListener("click", (event) => {
            if (event.target.closest("[data-summary-refresh]")) void this.load();
        });
        this.updatePeriodLabel();
    }

    updatePeriodLabel() {
        const label = this.container.querySelector("[data-summary-period-label]");
        if (label) label.textContent = formatPeriodLabel(this.anchorDate, this.period);
    }

    handleChange(event) {
        if (event.target.matches("[data-summary-period]")) {
            this.period = event.target.value;
        } else if (event.target.matches("[data-summary-date]")) {
            if (!event.target.value) return;
            this.anchorDate = event.target.value;
        } else {
            return;
        }
        this.updatePeriodLabel();
        void this.load();
    }

    async load() {
        const requestId = ++this.requestId;
        const feedback = this.container.querySelector("[data-summary-feedback]");
        if (feedback) {
            feedback.textContent = "Đang tải số liệu doanh thu...";
            feedback.classList.remove("app-error");
        }

        try {
            const previousAnchorDate = getPreviousAnchorDate(this.anchorDate, this.period);
            const [report, previousReport] = await Promise.all([
                this.onLoad(this.period, this.anchorDate),
                this.onLoad(this.period, previousAnchorDate)
            ]);
            if (requestId !== this.requestId) return;
            const summary = report?.summary || {};
            const previousSummary = previousReport?.summary || {};
            this.container.querySelectorAll("[data-summary-compare]").forEach((element) => {
                const key = element.dataset.summaryCompare;
                element.textContent = getComparisonLabel(summary[key], previousSummary[key]);
            });
            const values = [
                currencyFormatter.format(Number(summary.net_revenue) || 0),
                currencyFormatter.format(Number(summary.paid_amount) || 0),
                currencyFormatter.format(Number(summary.refunded_amount) || 0),
                numberFormatter.format(Number(summary.paid_orders) || 0) + " đơn"
            ];
            this.container.querySelectorAll("[data-summary-metrics] .revenue-report-metric").forEach((card, index) => {
                const strong = card.querySelector("strong");
                if (strong) strong.textContent = values[index];
            });
            if (feedback) feedback.textContent = "Đã cập nhật số liệu tổng hợp.";
        } catch (error) {
            if (requestId !== this.requestId) return;
            console.error("Không thể tải tổng hợp doanh thu:", error);
            if (feedback) {
                feedback.textContent = error.message || "Không thể tải tổng hợp doanh thu.";
                feedback.classList.add("app-error");
            }
        }
    }
}
