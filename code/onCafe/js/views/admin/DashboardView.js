export function createDashboardPanel(profile, {
    isAdmin,
    isSeller,
    isCashier,
    canManageProducts,
    canManageEmployees
}) {
    const dashboardPanel = document.createElement("section");
    dashboardPanel.className = "admin-panel";
    dashboardPanel.dataset.panel = "overview";
    dashboardPanel.innerHTML = isSeller ? `
        <section class="dashboard-welcome">
            <p class="eyebrow">TỔNG QUAN BÁN HÀNG</p>
            <h2 data-dashboard-greeting></h2>
            <p>Theo dõi đơn hàng hoàn tất và các đồ uống được khách hàng lựa chọn nhiều nhất.</p>
        </section>
        <section class="dashboard-metrics seller-dashboard-metrics" aria-label="Thống kê bán hàng">
            <article class="dashboard-metric"><span>Đơn hàng đã đặt</span><strong data-seller-order-count>—</strong><small>Tất cả trạng thái</small></article>
            <article class="dashboard-metric"><span>Đơn hàng hoàn tất</span><strong data-seller-completed-count>—</strong><small>Đơn đã giao thành công</small></article>
            <article class="dashboard-metric"><span>Đồ uống đã bán</span><strong data-seller-units-sold>—</strong><small>Tính từ đơn hàng hoàn tất</small></article>
        </section>
        <section class="dashboard-report-card seller-sales-card">
            <div>
                <p class="eyebrow">MẶT HÀNG ĐƯỢC ƯA CHUỘNG</p>
                <h3>Số lượng đồ uống đã bán</h3>
                <p>Thống kê theo số lượng từng món trong các đơn hàng hoàn tất.</p>
            </div>
            <div class="seller-sales-chart" data-seller-sales-chart aria-live="polite">
                <p role="status">Đang tải thống kê bán hàng...</p>
            </div>
        </section>
        <section class="dashboard-shortcuts">
            <h3>Truy cập nhanh</h3>
            <div>
                <button class="dashboard-shortcut" type="button" data-open-section="drinks"><span aria-hidden="true"><i class="bi bi-cup-hot-fill"></i></span> Quản lý đồ uống <b aria-hidden="true"><i class="bi bi-arrow-right"></i></b></button>
                <button class="dashboard-shortcut" type="button" data-open-section="orders"><span aria-hidden="true"><i class="bi bi-receipt"></i></span> Quản lý đơn hàng <b aria-hidden="true"><i class="bi bi-arrow-right"></i></b></button>
            </div>
        </section>` : isCashier ? `
        <section class="dashboard-welcome cashier-dashboard-welcome">
            <p class="eyebrow">KHU VỰC THU NGÂN</p>
            <h2 data-dashboard-greeting></h2>
            <p>Theo dõi doanh thu, tình hình đơn hàng và trạng thái thanh toán trong ngày.</p>
        </section>
        <section class="dashboard-metrics cashier-dashboard-metrics" aria-label="Tình hình đơn hàng trong ngày">
            <article class="dashboard-metric"><span>Doanh thu hôm nay</span><strong data-cashier-today-revenue>—</strong><small>Đã thu trừ tiền hoàn</small></article>
            <article class="dashboard-metric"><span>Đơn thanh toán hôm nay</span><strong data-cashier-paid-count>—</strong><small>Tính theo thời điểm thu tiền</small></article>
            <article class="dashboard-metric"><span>Đơn hàng hôm nay</span><strong data-cashier-today-count>—</strong><small>Tất cả nguồn đơn</small></article>
            <article class="dashboard-metric"><span>Chưa thanh toán</span><strong data-cashier-unpaid-count>—</strong><small>Đơn chưa ghi nhận thanh toán</small></article>
        </section>
        <section class="cashier-dashboard-comparison" aria-label="So sánh doanh thu và trạng thái đơn hàng">
            <p data-cashier-revenue-comparison>Đang so sánh doanh thu với ngày hôm qua...</p>
            <div class="cashier-dashboard-statuses">
                <span>Hoàn tất: <strong data-cashier-completed-count>—</strong></span>
                <span>Đang xử lý: <strong data-cashier-active-count>—</strong></span>
                <span>Đã hoàn tiền: <strong data-cashier-refunded-count>—</strong></span>
            </div>
        </section>
        <section class="dashboard-shortcuts cashier-dashboard-shortcuts">
            <h3>Truy cập nhanh</h3>
            <div>
                <button class="dashboard-shortcut" type="button" data-open-section="orders"><span aria-hidden="true">☷</span> Quản lý đơn hàng <b aria-hidden="true">→</b></button>
                <button class="dashboard-shortcut" type="button" data-open-section="revenue-summary"><span aria-hidden="true">₫</span> Tổng hợp doanh thu <b aria-hidden="true">→</b></button>
                <button class="dashboard-shortcut" type="button" data-open-section="revenue"><span aria-hidden="true">↗</span> Báo cáo doanh thu <b aria-hidden="true">→</b></button>
            </div>
        </section>` : `
        <section class="dashboard-welcome">
            <p class="eyebrow">TỔNG QUAN ONCAFE</p>
            <h2 data-dashboard-greeting></h2>
            <p>Theo dõi doanh thu và tình hình hoạt động của quán trong ngày.</p>
            <button class="button button-primary" type="button" data-admin-overview-refresh>↻ Làm mới số liệu</button>
        </section>
        <section class="dashboard-metrics" aria-label="Các chỉ số kinh doanh">
            <article class="dashboard-metric"><span>Doanh thu thuần hôm nay</span><strong data-admin-today-revenue>—</strong><small>Đã thu trừ tiền hoàn</small></article>
            <article class="dashboard-metric"><span>Đơn hàng hôm nay</span><strong data-admin-today-orders>—</strong><small>Tất cả trạng thái</small></article>
            <article class="dashboard-metric"><span>Đồ uống đang bán</span><strong data-admin-active-products>—</strong><small>Sản phẩm đang hoạt động</small></article>
            ${isAdmin ? '<article class="dashboard-metric"><span>Nhân viên</span><strong data-admin-employee-count>—</strong><small>Tài khoản nhân viên</small></article>' : ""}
        </section>
        <section class="dashboard-report-card">
            <div>
                <p class="eyebrow">NGUYÊN TẮC GHI NHẬN</p>
                <h3>Doanh thu trong ngày</h3>
                <p>Doanh thu thuần được lấy từ báo cáo hệ thống: tổng tiền đã thu trừ tổng tiền hoàn. Dữ liệu được tải khi mở Tổng quan và có thể cập nhật bằng nút Làm mới số liệu.</p>
            </div>
        </section>
        <section class="dashboard-shortcuts">
            <h3>Truy cập nhanh</h3>
            <div>
                <button class="dashboard-shortcut" type="button" data-open-section="drinks"><span aria-hidden="true">◈</span> Quản lý đồ uống <b aria-hidden="true">→</b></button>
                <button class="dashboard-shortcut" type="button" data-open-section="orders"><span aria-hidden="true">☷</span> Xem đơn hàng <b aria-hidden="true">→</b></button>
            </div>
        </section>`;
    dashboardPanel.querySelector("[data-dashboard-greeting]").textContent =
        `Chào mừng trở lại, ${profile.full_name || (isAdmin ? "Quản trị viên" : isSeller ? "nhân viên bán hàng" : "thu ngân")}`;
    dashboardPanel.querySelectorAll("[data-open-section]").forEach((button) => {
        const targetSection = button.dataset.openSection;
        const allowed = targetSection === "drinks"
            ? canManageProducts
            : targetSection === "employees"
                ? canManageEmployees
                : targetSection === "orders";
        button.hidden = !allowed;
    });
    return dashboardPanel;
}


/**
 * Chịu trách nhiệm cập nhật các chỉ số và biểu đồ trên màn hình tổng quan.
 * Việc lấy dữ liệu và tính toán được điều phối ở Controller/Service.
 */
export class AdminOverviewView {
    constructor({ dashboardPanel, popularPanel }) {
        this.dashboardPanel = dashboardPanel;
        this.popularPanel = popularPanel;
    }

    setAdminOverviewLoading() {
        this.setText([
            "[data-admin-today-revenue]",
            "[data-admin-today-orders]",
            "[data-admin-active-products]",
            "[data-admin-employee-count]"
        ], "…");
    }

    renderAdminOverview({ revenue, orders, products, employees }) {
        this.setText([
            "[data-admin-today-revenue]",
            "[data-admin-today-orders]",
            "[data-admin-active-products]",
            "[data-admin-employee-count]"
        ], null, [revenue, orders, products, employees]);
    }

    renderCashierOverview({ revenue, paid, today, unpaid, completed, active, refunded, comparison }) {
        this.setText([
            "[data-cashier-today-revenue]",
            "[data-cashier-paid-count]",
            "[data-cashier-today-count]",
            "[data-cashier-unpaid-count]",
            "[data-cashier-completed-count]",
            "[data-cashier-active-count]",
            "[data-cashier-refunded-count]"
        ], null, [revenue, paid, today, unpaid, completed, active, refunded]);
        const comparisonElement = this.dashboardPanel.querySelector("[data-cashier-revenue-comparison]");
        if (comparisonElement) {
            comparisonElement.textContent = comparison;
            comparisonElement.classList.remove("app-error");
        }
    }

    setCashierOverviewLoading() {
        this.setText([
            "[data-cashier-today-revenue]",
            "[data-cashier-paid-count]",
            "[data-cashier-today-count]",
            "[data-cashier-unpaid-count]",
            "[data-cashier-completed-count]",
            "[data-cashier-active-count]",
            "[data-cashier-refunded-count]"
        ], "…");
        const comparison = this.dashboardPanel.querySelector("[data-cashier-revenue-comparison]");
        if (comparison) comparison.textContent = "Đang so sánh doanh thu với ngày hôm qua...";
    }

    renderPopularDrinks(statistics) {
        const chart = this.popularPanel.querySelector("[data-popular-drinks]");
        if (!chart) return;
        this.setText([
            "[data-popular-order-count]",
            "[data-popular-units]",
            "[data-popular-product-count]"
        ], null, [
            statistics.completedOrderCount,
            statistics.totalUnits,
            statistics.productCount
        ]);
        chart.replaceChildren();

        if (!statistics.products.length) {
            this.renderEmpty(chart, "Chưa có đơn hàng hoàn tất có đồ uống để thống kê. Khi đơn hàng được chuyển sang Hoàn tất, dữ liệu sẽ xuất hiện tại đây.");
            return;
        }

        const maxQuantity = statistics.products[0][1].quantity;
        const currencyFormatter = new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
            maximumFractionDigits: 0
        });

        for (const [name, sales] of statistics.products) {
            const row = document.createElement("div");
            row.className = "seller-sales-row popular-drink-row";
            const labelWrap = document.createElement("div");
            labelWrap.className = "popular-drink-label";
            const label = document.createElement("span");
            label.className = "seller-sales-name";
            label.textContent = name;
            const revenue = document.createElement("small");
            revenue.className = "popular-drink-revenue";
            revenue.textContent = currencyFormatter.format(sales.revenue);
            labelWrap.append(label, revenue);

            const track = document.createElement("div");
            track.className = "seller-sales-track";
            const bar = document.createElement("span");
            bar.style.width = `${Math.max(4, (sales.quantity / maxQuantity) * 100)}%`;
            track.append(bar);

            const value = document.createElement("strong");
            value.textContent = `${sales.quantity} ly`;
            row.append(labelWrap, track, value);
            chart.append(row);
        }
    }

    setPopularDrinksLoading() {
        const chart = this.popularPanel.querySelector("[data-popular-drinks]");
        if (!chart) return;
        this.renderLoading(chart, "Đang tải dữ liệu đồ uống bán chạy...");
    }

    renderSellerOverview(statistics) {
        this.setText([
            "[data-seller-order-count]",
            "[data-seller-completed-count]",
            "[data-seller-units-sold]"
        ], null, [
            statistics.orderCount,
            statistics.completedOrderCount,
            statistics.totalUnitsSold
        ]);
        const chart = this.dashboardPanel.querySelector("[data-seller-sales-chart]");
        if (!chart) return;
        chart.replaceChildren();

        if (!statistics.topProducts.length) {
            this.renderEmpty(chart, "Chưa có đồ uống nào được bán trong đơn hàng hoàn tất.");
            return;
        }

        const maxQuantity = statistics.topProducts[0].quantity;
        for (const { name, quantity } of statistics.topProducts) {
            const row = document.createElement("div");
            row.className = "seller-sales-row";
            const label = document.createElement("span");
            label.className = "seller-sales-name";
            label.textContent = name;
            const track = document.createElement("div");
            track.className = "seller-sales-track";
            const bar = document.createElement("span");
            bar.style.width = `${Math.max(4, (quantity / maxQuantity) * 100)}%`;
            track.append(bar);
            const value = document.createElement("strong");
            value.textContent = String(quantity);
            row.append(label, track, value);
            chart.append(row);
        }
    }

    setSellerOverviewLoading() {
        const chart = this.dashboardPanel.querySelector("[data-seller-sales-chart]");
        if (chart) this.renderLoading(chart, "Đang tải thống kê bán hàng...");
    }

    renderChartError(chart, message) {
        if (!chart) return;
        chart.replaceChildren();
        const element = document.createElement("p");
        element.className = "app-error";
        element.setAttribute("role", "alert");
        element.textContent = message;
        chart.append(element);
    }

    renderCashierOverviewError(message) {
        const selectors = [
            "[data-cashier-today-revenue]",
            "[data-cashier-paid-count]",
            "[data-cashier-today-count]",
            "[data-cashier-unpaid-count]",
            "[data-cashier-completed-count]",
            "[data-cashier-active-count]",
            "[data-cashier-refunded-count]"
        ];
        this.setText(selectors, "—");
        const comparison = this.dashboardPanel.querySelector("[data-cashier-revenue-comparison]");
        if (comparison) {
            comparison.textContent = message;
            comparison.classList.add("app-error");
        }
    }

    renderAdminOverviewError() {
        this.setText([
            "[data-admin-today-revenue]",
            "[data-admin-today-orders]",
            "[data-admin-active-products]",
            "[data-admin-employee-count]"
        ], "—");
    }

    renderLoading(container, message) {
        container.replaceChildren();
        const element = document.createElement("p");
        element.setAttribute("role", "status");
        element.textContent = message;
        container.append(element);
    }

    renderEmpty(container, message) {
        const element = document.createElement("p");
        element.className = "seller-sales-empty";
        element.textContent = message;
        container.append(element);
    }

    setText(selectors, fallback, values = []) {
        selectors.forEach((selector, index) => {
            const element = this.dashboardPanel.querySelector(selector);
            if (element) element.textContent = values.length ? String(values[index]) : fallback;
        });
    }
}
