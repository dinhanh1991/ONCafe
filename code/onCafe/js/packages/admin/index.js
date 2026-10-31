import { supabase } from "../../config/supabase.js";
import { AuthService } from "../../services/AuthService.js";
import { ProductRepository } from "../../repositories/ProductRepo.js";
import { ProductService } from "../../services/ProductService.js";
import { ProductView } from "../../views/ProductView.js";
import { EmployeeService } from "../../services/EmployeeService.js";
import { EmployeeView } from "../../views/EmployeeView.js";
import { EmployeeProfileView } from "../../views/EmployeeProfileView.js";
import { OrderRepository } from "../../repositories/OrderRepo.js";
import { OrderService } from "../../services/OrderService.js";
import { OrderView } from "../../views/OrderView.js";
import { CounterOrderView } from "../../views/CounterOrderView.js";
import { RevenueReportRepository } from "../../repositories/RevenueReportRepo.js";
import { RevenueReportService } from "../../services/RevenueReportService.js";
import { RevenueReportView } from "../../views/RevenueReportView.js";
import { RevenueSummaryView } from "../../views/RevenueSummaryView.js";
import { isSectionAllowed, getAdminPageUrl } from "../../utils/AdminNavigation.js";
import { createNavButton } from "./ui/AdminNavigation.js";
import { renderAccessMessage } from "./ui/AccessMessage.js";
import { createAdminWorkspace } from "./views/AdminWorkspaceView.js";
import { createAdminOverviewLoaders } from "./controllers/AdminOverviewController.js";

const authService = new AuthService();
const productService = new ProductService(new ProductRepository());
const employeeService = new EmployeeService();
const orderService = new OrderService(new OrderRepository());
const revenueReportService = new RevenueReportService(new RevenueReportRepository());
const app = document.querySelector("#app");
const logoutButton = document.querySelector("#logoutButton");
const dashboardHomeLink = document.querySelector("#dashboardHomeLink");

function showMessage(message, isError = false) {
    renderAccessMessage(app, message, isError);
}

async function startApp() {
    if (!app) throw new Error("Không tìm thấy vùng hiển thị ứng dụng.");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) {
        showMessage("Bạn cần đăng nhập để sử dụng hệ thống quản lý ONCafe.");
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .single();
    if (profileError) throw profileError;

    const role = profile.role;
    const isAdmin = role === "admin";
    const isSeller = role === "seller";
    const isCashier = role === "cashier";
    const isStaff = isAdmin || isSeller || isCashier;
    if (!isStaff) {
        showMessage("Tài khoản này không có quyền truy cập khu vực nhân viên.", true);
        return;
    }

    const accountLabel = document.querySelector("#accountLabel");
    if (accountLabel) accountLabel.textContent = `Xin chào, ${profile.full_name || "nhân viên"}`;
    if (logoutButton) logoutButton.hidden = false;
    if (dashboardHomeLink) {
        dashboardHomeLink.innerHTML = `<i class="bi bi-house-door-fill me-1" aria-hidden="true"></i>${isSeller ? "Trang chủ Seller" : isAdmin ? "Trang chủ Admin" : "Trang tổng quan"}`;

        dashboardHomeLink.href = window.location.pathname.includes("/pages/admin/")
            ? "./dashboard.html"
            : "./pages/admin/dashboard.html";

        dashboardHomeLink.hidden = false;
    }

    const {
        panels, dashboardPanel, orderPanel, productPanel, counterPanel,
        employeePanel, profilePanel, revenuePanel, revenueSummaryPanel,
        popularPanel, navigation, pageTitle, pageDescription
    } = createAdminWorkspace(app, profile, {
        isAdmin, isSeller, isCashier, canManageProducts, canManageEmployees
    });


    if (canManageProducts) {
        productView = new ProductView(productPanel, {
            onSave: (product) => product.id === undefined
                ? productService.addProduct(product)
                : productService.updateProduct(product.id, product),
            onDelete: (id) => productService.deleteProduct(id)
        });
    }
    if (canManageEmployees) {
        employeeView = new EmployeeView(employeePanel, {
            onLoad: () => employeeService.listEmployees(),
            onCreate: (employee) => employeeService.createEmployee(employee),
            onUpdate: (employee) => employeeService.updateEmployee(employee),
            onDelete: (id) => employeeService.deleteEmployee(id)
        });
        employeeView.render();
    }
    employeeProfileView = new EmployeeProfileView(profilePanel, {
            onLoad: () => employeeService.getMyProfile(),
            onSave: (data) => employeeService.updateMyProfile(data),
            onChangePassword: (password) => employeeService.changeMyPassword(password)
        });
    void employeeProfileView.render();

    const orderView = new OrderView(orderPanel, {
        onUpdateStatus: isCashier ? null : (id, status) => orderService.updateStatus(id, status),
        onUpdatePayment: isCashier ? null : (id, status) => orderService.updatePayment(id, status),
        onMarkArrived: isCashier ? null : (id) => orderService.markDeliveryArrived(id),
        onRefresh: () => orderService.getStaffOrders(),
        readOnly: isCashier
    });

    const revenueSummaryView = new RevenueSummaryView(revenueSummaryPanel, {
        onLoad: (period, date) => revenueReportService.getReport(period, date)
    });

    const revenueReportView = new RevenueReportView(revenuePanel, {
        onLoad: (period, date) => revenueReportService.getReport(period, date)
    });

    const counterOrderView = new CounterOrderView(counterPanel, {
        onLoadProducts: () => productService.getAllProducts(),
        onCreateOrder: (order) => orderService.createCounterOrder(order),
        onCreated: () => orderView.refresh(),
        onCreateQrConfirmation: (id) => orderService.createQrConfirmation(id),
        onCheckQrPayment: async (id) => {
            const orders = await orderService.getStaffOrders();
            return orders.find((order) => String(order.id) === String(id)) || null;
        },
        onQrPaymentConfirmed: () => activateSection("overview")
    });

    async function loadProducts() {
        if (!productView) return;
        productPanel.innerHTML = '<p role="status">Đang tải sản phẩm...</p>';
        try {
            productView.render(await productService.getAllProducts());
        } catch (error) {
            console.error("Không thể tải sản phẩm:", error);
            productPanel.textContent = error.message || "Không thể tải danh sách sản phẩm.";
        }
    }

    async function loadEmployees() {
        if (!employeeView) return;
        await employeeView.load();
    }

    async function loadOrders() {
        orderPanel.innerHTML = '<p role="status">Đang tải đơn hàng...</p>';
        try {
            orderView.render(await orderService.getStaffOrders());
        } catch (error) {
            console.error("Không thể tải đơn hàng:", error);
            orderPanel.innerHTML = "";
            const message = document.createElement("p");
            message.className = "app-error";
            message.setAttribute("role", "alert");
            message.textContent = error.message || "Không thể tải danh sách đơn hàng.";
            const help = document.createElement("p");
            help.textContent = "Nếu đây là lần đầu triển khai, hãy chạy migration staff_order_management trong Supabase SQL Editor.";
            orderPanel.append(message, help);
        }
    }

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

    const { loadPopularDrinks, loadCashierOverview, loadSellerOverview } = createAdminOverviewLoaders({
        dashboardPanel,
        popularPanel,
        orderService,
        revenueReportService
    });

    const requestedSection = document.body.dataset.adminSection || "overview";
    activateSection(requestedSection);
}

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try {
            await authService.logout();
            window.location.href = window.location.pathname.includes("/pages/admin/")
                ? "../auth/login.html"
                : "./pages/auth/login.html";
        } catch (error) {
            console.error("Không thể đăng xuất:", error);
            logoutButton.disabled = false;
        }
    });
}

startApp().catch((error) => {
    console.error("Không thể khởi chạy ONCafe:", error);
    showMessage(error.message || "Không thể tải ứng dụng. Vui lòng tải lại trang.", true);
});
