import { createNavButton } from "../ui/AdminNavigation.js";
import { createDashboardPanel } from "./DashboardView.js";

export function createAdminWorkspace(app, profile, {
    isAdmin,
    isSeller,
    isCashier,
}) {
    app.replaceChildren();
    const workspace = document.createElement("div");
    const canManageProducts = isAdmin || isSeller;
    const canManageEmployees = isAdmin;
    workspace.className = isAdmin ? "admin-layout" : "admin-layout staff-workspace";
    const panels = document.createElement("div");
    panels.className = isAdmin ? "admin-panels" : "app-panels";
    const dashboardPanel = createDashboardPanel(profile, {
        isAdmin,
        isSeller,
        isCashier,
        canManageProducts,
        canManageEmployees
    });
    const orderPanel = document.createElement("section");
    orderPanel.className = "app-panel";
    orderPanel.dataset.panel = "orders";
    let productPanel = null;
    let counterPanel = null;
    let productView = null;
    let employeePanel = null;
    let employeeView = null;
    let profilePanel = null;
    let employeeProfileView = null;
    let revenuePanel = null;
    let revenueSummaryPanel = null;
    let expensePanel = null;
    let popularPanel = null;
    let navigation = null;
    let pageTitle = null;
    let pageDescription = null;

    {
        const sidebar = document.createElement("aside");
        sidebar.className = "admin-sidebar";
        sidebar.innerHTML = `
            <div class="admin-sidebar-heading">
                <span class="admin-sidebar-mark" aria-hidden="true">O</span>
                <span><strong>ONCafe</strong><small>${isAdmin ? "QUẢN TRỊ" : isSeller ? "BÁN HÀNG" : "THU NGÂN"}</small></span>
            </div>
            <p class="admin-sidebar-label">MENU CHÍNH</p>`;
        navigation = document.createElement("nav");
        navigation.className = "admin-navigation";
        navigation.setAttribute("aria-label", "Điều hướng nhân viên");
        const navItems = [
            ["bi-grid-1x2-fill", "Tổng quan", "overview", true],
            ["bi-cup-hot-fill", "Quản lý đồ uống", "drinks", canManageProducts],
            ["bi-people-fill", "Quản lý nhân viên", "employees", canManageEmployees],
            ["bi-cart-plus-fill", "Tạo đơn tại quầy", "counter-order", isAdmin || isSeller],
            ["bi-receipt", "Quản lý đơn hàng", "orders", true],
            ["bi-cash-stack", "Tổng hợp doanh thu", "revenue-summary", isAdmin || isCashier],
            ["bi-graph-up-arrow", "Báo cáo doanh thu", "revenue", isAdmin || isCashier],
            ["bi-star-fill", "Đồ uống bán chạy", "popular", isAdmin || isSeller],
            ["bi-person-circle", "Thông tin tài khoản", "my-profile", true]
        ];
        navItems.filter((item) => item[3]).forEach(([icon, label, section]) =>
            navigation.append(createNavButton(icon, label, section))
        );
        sidebar.append(navigation);

        const adminMain = document.createElement("div");
        adminMain.className = "admin-main";
        const contentHeading = document.createElement("header");
        contentHeading.className = "admin-content-heading";
        contentHeading.innerHTML = `
            <div><p class="eyebrow">ONCAFE / ${isAdmin ? "QUẢN TRỊ" : isSeller ? "BÁN HÀNG" : "THU NGÂN"}</p><h1 data-admin-page-title></h1><p data-admin-page-description></p></div>
            <span class="admin-role-badge">${isAdmin ? "Quản trị viên" : isSeller ? "Người bán hàng" : "Thu ngân"}</span>`;
        pageTitle = contentHeading.querySelector("[data-admin-page-title]");
        pageDescription = contentHeading.querySelector("[data-admin-page-description]");

        panels.append(dashboardPanel);
        productPanel = document.createElement("section");
        productPanel.className = "app-panel";
        productPanel.dataset.panel = "drinks";
        productPanel.hidden = true;
        panels.append(productPanel);
        if (canManageEmployees) {
            employeePanel = document.createElement("section");
            employeePanel.className = "app-panel";
            employeePanel.dataset.panel = "employees";
            employeePanel.hidden = true;
            panels.append(employeePanel);
        }
        revenueSummaryPanel = document.createElement("section");
        revenueSummaryPanel.className = "admin-panel";
        revenueSummaryPanel.dataset.panel = "revenue-summary";
        revenueSummaryPanel.hidden = true;
        panels.append(revenueSummaryPanel);
        revenuePanel = document.createElement("section");
        revenuePanel.className = "admin-panel";
        revenuePanel.dataset.panel = "revenue";
        revenuePanel.hidden = true;
        revenuePanel.innerHTML = `
            <section class="revenue-placeholder">
                <div class="revenue-placeholder-icon" aria-hidden="true">↗</div>
                <p class="eyebrow">BÁO CÁO KINH DOANH</p>
                <h2>Chi tiết doanh thu</h2>
                <p>Khu vực này sẽ hiển thị doanh thu theo ngày, món bán chạy và các báo cáo kinh doanh sau khi kết nối dữ liệu.</p>
                <div class="revenue-placeholder-grid" aria-hidden="true"><span></span><span></span><span></span></div>
            </section>`;
        panels.append(revenuePanel);
        popularPanel = document.createElement("section");
        popularPanel.className = "admin-panel";
        popularPanel.dataset.panel = "popular";
        popularPanel.hidden = true;
        popularPanel.innerHTML = `
            <section class="seller-popular-page">
                <section class="dashboard-welcome">
                    <p class="eyebrow">BÁO CÁO SẢN PHẨM</p>
                    <h2>Đồ uống bán chạy</h2>
                    <p>Xếp hạng các món được khách hàng mua nhiều nhất, tính trên những đơn hàng đã hoàn tất.</p>
                </section>
                <section class="dashboard-metrics seller-dashboard-metrics" aria-label="Tổng quan đồ uống bán chạy">
                    <article class="dashboard-metric"><span>Đơn hoàn tất</span><strong data-popular-order-count>—</strong><small>Đơn đã giao thành công</small></article>
                    <article class="dashboard-metric"><span>Tổng số ly đã bán</span><strong data-popular-units>—</strong><small>Tính từ đơn hoàn tất</small></article>
                    <article class="dashboard-metric"><span>Số món có phát sinh bán</span><strong data-popular-product-count>—</strong><small>Các món có trong đơn hoàn tất</small></article>
                </section>
                <section class="dashboard-report-card seller-sales-card">
                    <div>
                        <p class="eyebrow">BẢNG XẾP HẠNG</p>
                        <h3>Top 10 đồ uống bán chạy</h3>
                        <p>Sắp xếp theo số lượng bán từ cao xuống thấp. Doanh thu được cộng từ các món trong đơn hoàn tất.</p>
                    </div>
                    <div class="seller-sales-chart" data-popular-drinks aria-live="polite">
                        <p role="status">Đang tải dữ liệu...</p>
                    </div>
                </section>
            </section>`;
        panels.append(popularPanel);
        counterPanel = document.createElement("section");
        counterPanel.className = "app-panel";
        counterPanel.dataset.panel = "counter-order";
        counterPanel.hidden = true;
        panels.append(counterPanel);
        panels.append(orderPanel);
        profilePanel = document.createElement("section");
        profilePanel.className = "app-panel";
        profilePanel.dataset.panel = "my-profile";
        profilePanel.hidden = true;
        panels.append(profilePanel);
        adminMain.append(contentHeading, panels);
        workspace.append(sidebar, adminMain);
    }
    return {
        panels, dashboardPanel, orderPanel, productPanel, counterPanel,
        employeePanel, profilePanel, revenuePanel, revenueSummaryPanel,
        popularPanel, navigation, pageTitle, pageDescription
    };
}
