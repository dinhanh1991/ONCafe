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
