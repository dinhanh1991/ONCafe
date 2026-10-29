import { supabase } from "./config/supabase.js";
import { AuthService } from "./services/AuthService.js";
import { ProductRepository } from "./repositories/ProductRepo.js";
import { ProductService } from "./services/ProductService.js";
import { ProductView } from "./views/ProductView.js";
import { EmployeeService } from "./services/EmployeeService.js";
import { EmployeeView } from "./views/EmployeeView.js";
import { OrderRepository } from "./repositories/OrderRepo.js";
import { OrderService } from "./services/OrderService.js";
import { OrderView } from "./views/OrderView.js";

const authService = new AuthService();
const productService = new ProductService(new ProductRepository());
const employeeService = new EmployeeService();
const orderService = new OrderService(new OrderRepository());
const app = document.querySelector("#app");
const logoutButton = document.querySelector("#logoutButton");

function showMessage(message, isError = false) {
    if (!app) return;
    app.replaceChildren();
    const section = document.createElement("section");
    section.className = "app-access-message";
    const paragraph = document.createElement("p");
    paragraph.className = isError ? "app-error" : "";
    paragraph.setAttribute("role", "status");
    paragraph.textContent = message;
    const linkParagraph = document.createElement("p");
    const link = document.createElement("a");
    link.href = "./pages/login.html";
    link.textContent = "Đến trang đăng nhập";
    linkParagraph.append(link);
    section.append(paragraph, linkParagraph);
    app.append(section);
}

function createNavButton(icon, label, value) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-nav-item";
    button.dataset.section = value;
    button.innerHTML = `<span class="admin-nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
    return button;
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

    if (!["admin", "cashier"].includes(profile.role)) {
        showMessage("Tài khoản này không có quyền truy cập khu vực nhân viên.", true);
        return;
    }

    const accountLabel = document.querySelector("#accountLabel");
    if (accountLabel) accountLabel.textContent = `Xin chào, ${profile.full_name || "nhân viên"}`;
    if (logoutButton) logoutButton.hidden = false;

    app.replaceChildren();
    const workspace = document.createElement("div");
    const canManageProducts = profile.role === "admin";
    workspace.className = canManageProducts ? "admin-layout" : "staff-workspace";
    const panels = document.createElement("div");
    panels.className = canManageProducts ? "admin-panels" : "app-panels";
    const dashboardPanel = document.createElement("section");
    dashboardPanel.className = "admin-panel";
    dashboardPanel.dataset.panel = "overview";
    dashboardPanel.innerHTML = `
        <section class="dashboard-welcome">
            <p class="eyebrow">TỔNG QUAN ONCAFE</p>
            <h2 data-dashboard-greeting></h2>
            <p>Chọn một khu vực ở thanh điều hướng để quản lý hoạt động quán.</p>
        </section>
        <section class="dashboard-metrics" aria-label="Các chỉ số kinh doanh">
            <article class="dashboard-metric"><span>Doanh thu hôm nay</span><strong>—</strong><small>Đang chờ kết nối báo cáo</small></article>
            <article class="dashboard-metric"><span>Đơn hàng hôm nay</span><strong>—</strong><small>Đang chờ kết nối báo cáo</small></article>
            <article class="dashboard-metric"><span>Đồ uống đang bán</span><strong>—</strong><small>Xem tại mục Quản lý đồ uống</small></article>
            <article class="dashboard-metric"><span>Nhân viên</span><strong>—</strong><small>Xem tại mục Quản lý nhân viên</small></article>
        </section>
        <section class="dashboard-report-card">
            <div>
                <p class="eyebrow">BÁO CÁO KINH DOANH</p>
                <h3>Doanh thu theo thời gian</h3>
                <p>Khu vực biểu đồ sẽ hiển thị doanh thu và xu hướng bán hàng khi hoàn thiện phần báo cáo.</p>
            </div>
            <div class="dashboard-chart-placeholder" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                <div class="dashboard-chart-baseline"></div>
            </div>
        </section>
        <section class="dashboard-shortcuts">
            <h3>Truy cập nhanh</h3>
            <div>
                <button class="dashboard-shortcut" type="button" data-open-section="drinks"><span aria-hidden="true">◈</span> Quản lý đồ uống <b aria-hidden="true">→</b></button>
                <button class="dashboard-shortcut" type="button" data-open-section="employees"><span aria-hidden="true">♙</span> Quản lý nhân viên <b aria-hidden="true">→</b></button>
                <button class="dashboard-shortcut" type="button" data-open-section="orders"><span aria-hidden="true">☷</span> Xem đơn hàng <b aria-hidden="true">→</b></button>
            </div>
        </section>`;
    dashboardPanel.querySelector("[data-dashboard-greeting]").textContent =
        `Chào mừng trở lại, ${profile.full_name || "Quản trị viên"}`;
    const orderPanel = document.createElement("section");
    orderPanel.className = "app-panel";
    orderPanel.dataset.panel = "orders";
    let productPanel = null;
    let productView = null;
    let employeePanel = null;
    let employeeView = null;
    let revenuePanel = null;
    let navigation = null;
    let pageTitle = null;
    let pageDescription = null;

    if (canManageProducts) {
        const sidebar = document.createElement("aside");
        sidebar.className = "admin-sidebar";
        sidebar.innerHTML = `
            <div class="admin-sidebar-heading">
                <span class="admin-sidebar-mark" aria-hidden="true">O</span>
                <span><strong>ONCafe</strong><small>QUẢN TRỊ</small></span>
            </div>
            <p class="admin-sidebar-label">MENU CHÍNH</p>`;
        navigation = document.createElement("nav");
        navigation.className = "admin-navigation";
        navigation.setAttribute("aria-label", "Điều hướng quản trị");
        [
            ["▦", "Tổng quan", "overview"],
            ["◈", "Quản lý đồ uống", "drinks"],
            ["♙", "Quản lý nhân viên", "employees"],
            ["↗", "Chi tiết doanh thu", "revenue"],
            ["☷", "Quản lý đơn hàng", "orders"]
        ].forEach(([icon, label, section]) => navigation.append(createNavButton(icon, label, section)));
        sidebar.append(navigation);

        const adminMain = document.createElement("div");
        adminMain.className = "admin-main";
        const contentHeading = document.createElement("header");
        contentHeading.className = "admin-content-heading";
        contentHeading.innerHTML = `
            <div><p class="eyebrow">ONCAFE / QUẢN TRỊ</p><h1 data-admin-page-title></h1><p data-admin-page-description></p></div>
            <span class="admin-role-badge">Quản trị viên</span>`;
        pageTitle = contentHeading.querySelector("[data-admin-page-title]");
        pageDescription = contentHeading.querySelector("[data-admin-page-description]");

        panels.append(dashboardPanel);
        productPanel = document.createElement("section");
        productPanel.className = "app-panel";
        productPanel.dataset.panel = "drinks";
        productPanel.hidden = true;
        panels.append(productPanel);
        employeePanel = document.createElement("section");
        employeePanel.className = "app-panel";
        employeePanel.dataset.panel = "employees";
        employeePanel.hidden = true;
        panels.append(employeePanel);
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
        panels.append(orderPanel);
        adminMain.append(contentHeading, panels);
        workspace.append(sidebar, adminMain);
    } else {
        panels.append(orderPanel);
        workspace.append(panels);
    }
    app.append(workspace);

    if (canManageProducts) {
        productView = new ProductView(productPanel, {
            onSave: (product) => product.id === undefined
                ? productService.addProduct(product)
                : productService.updateProduct(product.id, product),
            onDelete: (id) => productService.deleteProduct(id)
        });
        employeeView = new EmployeeView(employeePanel, {
            onLoad: () => employeeService.listEmployees(),
            onCreate: (employee) => employeeService.createEmployee(employee),
            onUpdate: (employee) => employeeService.updateEmployee(employee),
            onDelete: (id) => employeeService.deleteEmployee(id)
        });
        employeeView.render();
    }

    const orderView = new OrderView(orderPanel, {
        onUpdateStatus: (id, status) => orderService.updateStatus(id, status),
        onRefresh: () => orderService.getStaffOrders()
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
        overview: ["Tổng quan", "Theo dõi nhanh tình hình hoạt động của ONCafe."],
        drinks: ["Quản lý đồ uống", "Danh sách, thông tin và số lượng đồ uống trong quán."],
        employees: ["Quản lý nhân viên", "Quản lý tài khoản và thông tin nhân viên."],
        revenue: ["Chi tiết doanh thu", "Báo cáo doanh thu và hiệu quả kinh doanh."],
        orders: ["Quản lý đơn hàng", "Theo dõi và cập nhật trạng thái đơn hàng."]
    };

    function activateSection(sectionName) {
        if (!sectionDetails[sectionName]) return;
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
        if (sectionName === "drinks") loadProducts();
        if (sectionName === "employees") loadEmployees();
        if (sectionName === "orders") loadOrders();
    }

    if (navigation) {
        navigation.addEventListener("click", (event) => {
            const button = event.target.closest("[data-section]");
            if (button) activateSection(button.dataset.section);
        });
        panels.addEventListener("click", (event) => {
            const button = event.target.closest("[data-open-section]");
            if (button) activateSection(button.dataset.openSection);
        });
    }
    activateSection(canManageProducts ? "overview" : "orders");
}

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try {
            await authService.logout();
            window.location.href = "./pages/login.html";
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
