import { isSectionAllowed, getAdminPageUrl } from "../../../utils/AdminNavigation.js";

export function createAdminSectionController({
    role,
    isAdmin,
    isSeller,
    isCashier,
    canManageProducts,
    canManageEmployees,
    navigation,
    panels,
    pageTitle,
    pageDescription,
    counterOrderView,
    orderView,
    revenueSummaryView,
    revenueReportView,
    showMessage,
    loadProducts,
    loadEmployees,
    loadOrders,
    loadAdminOverview,
    loadSellerOverview,
    loadCashierOverview,
    loadPopularDrinks
}) {
    const sectionDetails = {
        overview: ["Tổng quan", isSeller ? "Theo dõi đơn hàng và mặt hàng được khách lựa chọn." : isCashier ? "Theo dõi đơn hàng trong ca và tình hình thanh toán." : "Theo dõi nhanh tình hình hoạt động của ONCafe."],
        "counter-order": ["Tạo đơn tại quầy", "Tạo đơn bán hàng, kiểm tra tồn kho và ghi nhận phương thức thanh toán."],
        drinks: ["Quản lý đồ uống", "Danh sách, thông tin và số lượng đồ uống trong quán."],
        employees: ["Quản lý nhân viên", "Quản lý tài khoản và thông tin nhân viên."],
        "revenue-summary": ["Tổng hợp doanh thu", "Theo dõi doanh thu thuần, tiền đã thu, tiền hoàn và số đơn đã thanh toán theo ngày, tháng, năm."],
        revenue: ["Báo cáo doanh thu", "Xem biểu đồ và bảng chi tiết doanh thu theo giờ, ngày hoặc tháng."],
        popular: ["Đồ uống bán chạy", "Theo dõi các sản phẩm được khách hàng lựa chọn nhiều nhất."],
        orders: ["Quản lý đơn hàng", isCashier ? "Tra cứu danh sách, chi tiết và trạng thái đơn hàng (chỉ xem)." : "Theo dõi và cập nhật trạng thái đơn hàng."],
        "my-profile": ["Thông tin tài khoản", "Cập nhật thông tin cá nhân và mật khẩu đăng nhập."]
    };

    let orderRefreshTimer = null;

    function navigateToSection(sectionName) {
        if (!isSectionAllowed(role, sectionName)) {
            showMessage("Tài khoản của bạn không có quyền truy cập trang này.", true);
            return;
        }
        const targetUrl = getAdminPageUrl(sectionName, window.location.pathname);
        if (targetUrl) window.location.href = targetUrl;
    }

    function activateSection(sectionName) {
        if (!sectionDetails[sectionName]) return;
        if (!isSectionAllowed(role, sectionName)) {
            showMessage("Tài khoản của bạn không có quyền truy cập trang này.", true);
            return;
        }
        if (orderRefreshTimer) {
            window.clearInterval(orderRefreshTimer);
            orderRefreshTimer = null;
        }
        if (sectionName !== "counter-order") counterOrderView.stopWatchingQrPayment();
        if (navigation) {
            for (const button of navigation.querySelectorAll("[data-section]")) {
                const active = button.dataset.section === sectionName;
                button.classList.toggle("is-active", active);
                button.setAttribute("aria-current", active ? "page" : "false");
            }
        }
        for (const panel of panels.querySelectorAll("[data-panel]")) {
            panel.hidden = panel.dataset.panel !== sectionName;
        }
        if (pageTitle && pageDescription) {
            [pageTitle.textContent, pageDescription.textContent] = sectionDetails[sectionName];
        }
        if (sectionName === "drinks" && canManageProducts) loadProducts();
        if (sectionName === "employees" && canManageEmployees) loadEmployees();
        if (sectionName === "orders") {
            loadOrders();
            orderRefreshTimer = window.setInterval(() => {
                if (!document.hidden) void orderView.refresh();
            }, 5000);
        }
        if (sectionName === "counter-order" && (isAdmin || isSeller)) void counterOrderView.render();
        if (sectionName === "revenue-summary" && (isAdmin || isCashier)) void revenueSummaryView.load();
        if (sectionName === "revenue" && (isAdmin || isCashier)) void revenueReportView.load();
        if (sectionName === "overview" && isAdmin) loadAdminOverview();
        if (sectionName === "overview" && isSeller) loadSellerOverview();
        if (sectionName === "overview" && isCashier) loadCashierOverview();
        if (sectionName === "popular" && (isAdmin || isSeller)) loadPopularDrinks();
    }

    if (navigation) {
        navigation.addEventListener("click", (event) => {
            const button = event.target.closest("[data-section]");
            if (button) navigateToSection(button.dataset.section);
        });
        panels.addEventListener("click", (event) => {
            const button = event.target.closest("[data-open-section]");
            if (button) navigateToSection(button.dataset.openSection);
        });
    }
    return { navigateToSection, activateSection };
}
