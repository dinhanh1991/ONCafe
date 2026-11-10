// Điều phối khởi tạo ứng dụng quản trị, xác thực quyền và nạp các khu vực quản lý.
import { AuthService } from "../../services/AuthService.js";
import { ProductRepository } from "../../repositories/ProductRepo.js";
import { ProductService } from "../../services/ProductService.js";
import { ProductView } from "../../views/admin/ProductView.js";
import { EmployeeService } from "../../services/EmployeeService.js";
import { EmployeeView } from "../../views/admin/EmployeeView.js";
import { EmployeeProfileView } from "../../views/admin/EmployeeProfileView.js";
import { OrderRepository } from "../../repositories/OrderRepo.js";
import { OrderService } from "../../services/OrderService.js";
import { CounterOrderController } from "./CounterOrderController.js";
import { OrderView } from "../../views/admin/OrderView.js";
import { CounterOrderView } from "../../views/admin/CounterOrderView.js";
import { RevenueReportRepository } from "../../repositories/RevenueReportRepo.js";
import { RevenueReportService } from "../../services/RevenueReportService.js";
import { RevenueReportView } from "../../views/admin/RevenueReportView.js";
import { RevenueSummaryView } from "../../views/admin/RevenueSummaryView.js";
import { renderAccessMessage } from "../../ui/admin/AccessMessage.js";
import { createAdminWorkspace } from "../../views/admin/AdminWorkspaceView.js";
import { createAdminOverviewLoaders } from "./AdminOverviewController.js";
import { createAdminSectionController } from "./AdminSectionController.js";
import { createStaffNotificationController } from "./StaffNotificationController.js";
import { getAdminPageUrl, isSectionAllowed } from "../../utils/admin/AdminNavigation.js";
import { supabase } from "../../config/supabase.js";
import { renderCoffeeLoading, clearCoffeeLoading, waitForCoffeeLoading } from "../../utils/CoffeeLoading.js";

const authService = new AuthService();
const productService = new ProductService(new ProductRepository());
const employeeService = new EmployeeService();
const orderService = new OrderService(new OrderRepository());
const revenueReportService = new RevenueReportService(new RevenueReportRepository());
const app = document.querySelector("#app");
const logoutButton = document.querySelector("#logoutButton");
const dashboardHomeLink = document.querySelector("#dashboardHomeLink");

// Hiển thị thông báo thành công hoặc lỗi cho người dùng.
function showMessage(message, isError = false) {
    // Hiển thị thông báo kết quả truy cập khu vực quản trị.
    renderAccessMessage(app, message, isError);
}

// Khởi tạo ứng dụng, xác thực tài khoản và nạp giao diện phù hợp.
async function startApp() {
    if (!app) throw new Error("Không tìm thấy vùng hiển thị ứng dụng.");
    const session = await authService.getCurrentSession();
    if (!session) {
        showMessage("Bạn cần đăng nhập để sử dụng hệ thống quản lý ONCafe.");
        return;
    }

    const profile = await authService.getMyProfile(session.user.id);

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
        dashboardHomeLink.innerHTML = '<i class="bi bi-house-door-fill me-1" aria-hidden="true"></i>Trang chủ';
        dashboardHomeLink.hidden = false;
    }

    const canManageProducts = isAdmin || isSeller;
    const canManageEmployees = isAdmin;
    let productView = null;
    let employeeView = null;
    let employeeProfileView = null;

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

    // Thông báo cho nhân viên: đơn mới/hoàn tất, đồ uống thêm/sửa/xóa (admin, seller), nhân viên mới tham gia.
    const orderNotifications = createStaffNotificationController({
        supabaseClient: supabase,
        getOrders: () => orderService.getStaffOrders(),
        userId: session.user.id,
        role,
        openSection: (section) => {
            const url = isSectionAllowed(role, section) ? getAdminPageUrl(section) : null;
            if (url) window.location.href = url;
        }
    });
    void orderNotifications.start();
    window.addEventListener("pagehide", () => orderNotifications.stop());

    const orderView = new OrderView(orderPanel, {
        // Thay đổi do chính nhân viên này thực hiện đã có phản hồi trên màn hình nên không thông báo lại.
        onUpdateStatus: isCashier ? null : async (id, status) => {
            const result = await orderService.updateStatus(id, status);
            if (status === "completed") orderNotifications.markHandled("completed", id);
            return result;
        },
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

    const counterOrderController = new CounterOrderController({
        createOrder: async (order) => {
            try {
                const createdOrder = await orderService.createCounterOrder(order);
                orderNotifications.markHandled("new", createdOrder.id);
                return createdOrder;
            } catch (error) {
                // Đơn đã tạo nhưng bước ghi nhận tiền mặt lỗi: vẫn là đơn do chính nhân viên này lập.
                if (error?.orderCreated?.id) orderNotifications.markHandled("new", error.orderCreated.id);
                throw error;
            }
        },
        refreshOrders: () => orderView.refresh(),
        createQrConfirmation: (id) => orderService.createQrConfirmation(id)
    });

    const counterOrderView = new CounterOrderView(counterPanel, {
        onLoadProducts: () => productService.getAllProducts(),
        orderController: counterOrderController,
        onCheckQrPayment: async (id) => {
            const orders = await orderService.getStaffOrders();
            return orders.find((order) => String(order.id) === String(id)) || null;
        },
        onQrPaymentConfirmed: () => sectionController.activateSection("overview")
    });

    // Tải danh sách sản phẩm từ dịch vụ.
    async function loadProducts() {
        if (!productView) return;
        renderCoffeeLoading(productPanel, "Đang pha dữ liệu đồ uống...");
        try {
            const products = await productService.getAllProducts();
            await waitForCoffeeLoading(productPanel);
            clearCoffeeLoading(productPanel);
            productView.render(products);
        } catch (error) {
            await waitForCoffeeLoading(productPanel);
            clearCoffeeLoading(productPanel);
            console.error("Không thể tải sản phẩm:", error);
            productView.renderLoadError(
                error.message || "Không thể tải danh sách sản phẩm. Vui lòng kiểm tra kết nối mạng.",
                loadProducts
            );
        }
    }

    // Tải danh sách nhân viên từ dịch vụ.
    async function loadEmployees() {
        if (!employeeView) return;
        await employeeView.load();
    }

    // Tải danh sách đơn hàng từ dịch vụ.
    async function loadOrders() {
        renderCoffeeLoading(orderPanel, "Đang chuẩn bị danh sách đơn hàng...");
        try {
            const orders = await orderService.getStaffOrders();
            await waitForCoffeeLoading(orderPanel);
            clearCoffeeLoading(orderPanel);
            orderView.render(orders);
        } catch (error) {
            await waitForCoffeeLoading(orderPanel);
            clearCoffeeLoading(orderPanel);
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

    const { loadPopularDrinks, loadAdminOverview, loadCashierOverview, loadSellerOverview } = createAdminOverviewLoaders({
        dashboardPanel,
        popularPanel,
        orderService,
        revenueReportService,
        productService,
        employeeService
    });

    const sectionController = createAdminSectionController({
        role, isAdmin, isSeller, isCashier, canManageProducts, canManageEmployees,
        navigation, panels, pageTitle, pageDescription,
        counterOrderView, orderView, revenueSummaryView, revenueReportView,
        showMessage, loadProducts, loadEmployees, loadOrders,
        loadAdminOverview, loadSellerOverview, loadCashierOverview, loadPopularDrinks
    });

    const requestedSection = document.body.dataset.adminSection || "overview";
    sectionController.activateSection(requestedSection);
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
    // Hiển thị thông báo thành công hoặc lỗi cho người dùng.
    showMessage(error.message || "Không thể tải ứng dụng. Vui lòng tải lại trang.", true);
});
