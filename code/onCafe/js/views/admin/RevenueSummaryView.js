import {
    currencyFormatter,
    numberFormatter,
    getLocalDateValue,
    formatPeriodLabel,
    getPreviousAnchorDate,
    getComparisonLabel
} from "../../utils/admin/RevenueReportUtils.js";


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
