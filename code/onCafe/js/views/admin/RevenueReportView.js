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

function formatDateLabel(value, period) {
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

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

export class RevenueReportView {
    constructor(container, { onLoad }) {
        if (!container) throw new Error("Không tìm thấy vùng hiển thị báo cáo doanh thu.");
        this.container = container;
        this.onLoad = onLoad;
        this.period = "day";
        this.anchorDate = getLocalDateValue();
        this.requestId = 0;

        this.container.innerHTML = `
            <section class="revenue-report" aria-labelledby="revenue-report-heading">
                <header class="revenue-report-heading">
                    <div>
                        <p class="eyebrow">BÁO CÁO KINH DOANH</p>
                        <h2 id="revenue-report-heading">Báo cáo doanh thu</h2>
                        <p data-revenue-period-label></p>
                    </div>
                    <button class="button button-primary" type="button" data-revenue-refresh>↻ Làm mới</button>
                </header>
                <div class="revenue-report-filters">
                    <label><span>Kiểu báo cáo</span>
                        <select data-revenue-period>
                            <option value="day">Theo ngày</option>
                            <option value="month">Theo tháng</option>
                            <option value="year">Theo năm</option>
                        </select>
                    </label>
                    <label><span>Chọn ngày / tháng / năm</span><input type="date" data-revenue-date></label>
                </div>
                <p class="revenue-report-feedback" data-revenue-feedback role="status" aria-live="polite"></p>
                <section class="revenue-report-metrics" data-revenue-summary aria-label="Tổng hợp số liệu doanh thu">
                    <article class="revenue-report-metric is-primary"><span>Doanh thu thuần</span><strong>—</strong><small data-revenue-compare="net_revenue">Đang so sánh...</small></article>
                    <article class="revenue-report-metric"><span>Đã thu</span><strong>—</strong><small data-revenue-compare="paid_amount">Đang so sánh...</small></article>
                    <article class="revenue-report-metric"><span>Đã hoàn tiền</span><strong>—</strong><small data-revenue-compare="refunded_amount">Đang so sánh...</small></article>
                    <article class="revenue-report-metric"><span>Đơn đã thanh toán</span><strong>—</strong><small data-revenue-compare="paid_orders">Đang so sánh...</small></article>
                </section>
                <section class="revenue-report-card">
                    <div class="revenue-report-section-heading"><div><p class="eyebrow">BIẾN ĐỘNG DOANH THU</p><h3>Tiền đã thu theo thời gian</h3></div></div>
                    <div class="revenue-report-chart" data-revenue-chart><p role="status">Đang tải báo cáo...</p></div>
                </section>
                <section class="revenue-report-card">
                    <div class="revenue-report-section-heading"><div><p class="eyebrow">CHI TIẾT</p><h3>Bảng tổng hợp theo kỳ</h3></div></div>
                    <div class="revenue-report-table-wrap">
                        <table class="revenue-report-table">
                            <thead><tr><th data-revenue-bucket-heading>Thời gian</th><th>Đơn đã thu</th><th>Tiền đã thu</th><th>Hoàn tiền</th><th>Doanh thu thuần</th></tr></thead>
                            <tbody data-revenue-rows><tr><td colspan="5">Đang tải dữ liệu...</td></tr></tbody>
                        </table>
                    </div>
                </section>
                <p class="revenue-report-note">Chỉ số “Đã thu” lấy từ đơn có trạng thái thanh toán Đã thanh toán. Đơn chưa thanh toán không được cộng vào doanh thu. Khoản hoàn tiền được trừ khi tính doanh thu thuần.</p>
            </section>`;

        this.container.querySelector("[data-revenue-period]").value = this.period;
        this.container.querySelector("[data-revenue-date]").value = this.anchorDate;
        this.container.addEventListener("change", (event) => this.handleChange(event));
        this.container.addEventListener("click", (event) => {
            if (event.target.closest("[data-revenue-refresh]")) void this.load();
        });
        this.updatePeriodLabel();
    }

    updatePeriodLabel() {
        const label = this.container.querySelector("[data-revenue-period-label]");
        const heading = this.container.querySelector("[data-revenue-bucket-heading]");
        if (label) label.textContent = formatDateLabel(this.anchorDate, this.period);
        if (heading) heading.textContent = this.period === "day" ? "Giờ" : this.period === "month" ? "Ngày" : "Tháng";
    }

    handleChange(event) {
        if (event.target.matches("[data-revenue-period]")) {
            this.period = event.target.value;
        } else if (event.target.matches("[data-revenue-date]")) {
            if (!event.target.value) return;
            this.anchorDate = event.target.value;
        } else return;
        this.updatePeriodLabel();
        void this.load();
    }

    async load() {
        const requestId = ++this.requestId;
        const feedback = this.container.querySelector("[data-revenue-feedback]");
        const chart = this.container.querySelector("[data-revenue-chart]");
        const rows = this.container.querySelector("[data-revenue-rows]");
        if (feedback) {
            feedback.textContent = "Đang tải dữ liệu doanh thu...";
            feedback.classList.remove("app-error");
        }
        if (chart) chart.textContent = "Đang tải báo cáo...";
        if (rows) rows.innerHTML = '<tr><td colspan="5">Đang tải dữ liệu...</td></tr>';

        try {
            const previousAnchorDate = getPreviousAnchorDate(this.anchorDate, this.period);
            const [report, previousReport] = await Promise.all([
                this.onLoad(this.period, this.anchorDate),
                this.onLoad(this.period, previousAnchorDate)
            ]);
            if (requestId !== this.requestId) return;
            this.renderReport(report, previousReport);
            if (feedback) feedback.textContent = "Đã cập nhật báo cáo.";
        } catch (error) {
            if (requestId !== this.requestId) return;
            console.error("Không thể tải báo cáo doanh thu:", error);
            if (feedback) {
                feedback.textContent = error.message || "Không thể tải báo cáo doanh thu.";
                feedback.classList.add("app-error");
            }
            if (chart) chart.textContent = "Không thể tải biểu đồ doanh thu.";
            if (rows) rows.innerHTML = '<tr><td colspan="5">Không thể tải dữ liệu.</td></tr>';
        }
    }

    renderReport(report, previousReport) {
        const summary = report?.summary || {};
        const previousSummary = previousReport?.summary || {};
        this.container.querySelectorAll("[data-revenue-compare]").forEach((element) => {
            const key = element.dataset.revenueCompare;
            element.textContent = getComparisonLabel(summary[key], previousSummary[key]);
        });
        const metrics = this.container.querySelector("[data-revenue-summary]");
        const chart = this.container.querySelector("[data-revenue-chart]");
        const rows = this.container.querySelector("[data-revenue-rows]");
        const buckets = Array.isArray(report?.buckets) ? report.buckets : [];
        const values = [
            currencyFormatter.format(Number(summary.net_revenue) || 0),
            currencyFormatter.format(Number(summary.paid_amount) || 0),
            currencyFormatter.format(Number(summary.refunded_amount) || 0),
            numberFormatter.format(Number(summary.paid_orders) || 0) + " đơn"
        ];
        metrics.querySelectorAll(".revenue-report-metric").forEach((card, index) => {
            const strong = card.querySelector("strong");
            if (strong) strong.textContent = values[index];
        });
        chart.replaceChildren();
        rows.replaceChildren();

        if (!buckets.length) {
            chart.append(createElement("p", "revenue-report-empty", "Chưa có giao dịch trong khoảng thời gian này."));
            const row = document.createElement("tr");
            const cell = createElement("td", "", "Chưa có giao dịch trong khoảng thời gian này.");
            cell.colSpan = 5;
            row.append(cell);
            rows.append(row);
            return;
        }

        const maxPaidAmount = Math.max(1, ...buckets.map((item) => Number(item.paid_amount) || 0));
        for (const bucket of buckets) {
            const paidAmount = Number(bucket.paid_amount) || 0;
            const refundedAmount = Number(bucket.refunded_amount) || 0;
            const netRevenue = Number(bucket.net_revenue) || 0;
            const chartRow = createElement("div", "revenue-chart-row");
            const label = createElement("span", "revenue-chart-label", bucket.label || "—");
            const track = createElement("div", "revenue-chart-track");
            const bar = createElement("span", "revenue-chart-bar");
            bar.style.width = `${Math.max(0, (paidAmount / maxPaidAmount) * 100)}%`;
            track.append(bar);
            const amount = createElement("strong", "revenue-chart-value", currencyFormatter.format(paidAmount));
            chartRow.append(label, track, amount);
            chart.append(chartRow);

            const row = document.createElement("tr");
            [
                bucket.label || "—",
                numberFormatter.format(Number(bucket.paid_orders) || 0),
                currencyFormatter.format(paidAmount),
                currencyFormatter.format(refundedAmount),
                currencyFormatter.format(netRevenue)
            ].forEach((value) => row.append(createElement("td", "", value)));
            rows.append(row);
        }
    }
}
