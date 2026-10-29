import { supabase } from "./config/supabase.js";
import { AuthService } from "./services/AuthService.js";
import { ProductRepository } from "./repositories/ProductRepo.js";
import { ProductService } from "./services/ProductService.js";
import { ProductView } from "./views/ProductView.js";
import { EmployeeService } from "./services/EmployeeService.js";
import { EmployeeView } from "./views/EmployeeView.js";
import { EmployeeProfileView } from "./views/EmployeeProfileView.js";
import { OrderRepository } from "./repositories/OrderRepo.js";
import { OrderService } from "./services/OrderService.js";
import { OrderView } from "./views/OrderView.js";
import { CounterOrderView } from "./views/CounterOrderView.js";

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

    app.replaceChildren();
    const workspace = document.createElement("div");
    const canManageProducts = isAdmin || isSeller;
    const canManageEmployees = isAdmin;
    workspace.className = isAdmin ? "admin-layout" : "admin-layout staff-workspace";
    const panels = document.createElement("div");
    panels.className = isAdmin ? "admin-panels" : "app-panels";
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
                <button class="dashboard-shortcut" type="button" data-open-section="drinks"><span aria-hidden="true">◈</span> Quản lý đồ uống <b aria-hidden="true">→</b></button>
                <button class="dashboard-shortcut" type="button" data-open-section="orders"><span aria-hidden="true">☷</span> Quản lý đơn hàng <b aria-hidden="true">→</b></button>
            </div>
        </section>` : `
        <section class="dashboard-welcome">
            <p class="eyebrow">TỔNG QUAN ONCAFE</p>
            <h2 data-dashboard-greeting></h2>
            <p>Chọn một khu vực ở thanh điều hướng để quản lý hoạt động quán.</p>
        </section>
        <section class="dashboard-metrics" aria-label="Các chỉ số kinh doanh">
            <article class="dashboard-metric"><span>Doanh thu hôm nay</span><strong>—</strong><small>Đang chờ kết nối báo cáo</small></article>
            <article class="dashboard-metric"><span>Đơn hàng hôm nay</span><strong>—</strong><small>Đang chờ kết nối báo cáo</small></article>
            <article class="dashboard-metric"><span>Đồ uống đang bán</span><strong>—</strong><small>Xem tại mục Quản lý đồ uống</small></article>
            ${isAdmin ? '<article class="dashboard-metric"><span>Nhân viên</span><strong>—</strong><small>Xem tại mục Quản lý nhân viên</small></article>' : ""}
        </section>
        ${!isSeller ? `<section class="dashboard-report-card">
            <div>
                <p class="eyebrow">BÁO CÁO KINH DOANH</p>
                <h3>Doanh thu theo thời gian</h3>
                <p>Khu vực biểu đồ sẽ hiển thị doanh thu và xu hướng bán hàng khi hoàn thiện phần báo cáo.</p>
            </div>
            <div class="dashboard-chart-placeholder" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
                <div class="dashboard-chart-baseline"></div>
            </div>
        </section>` : ""}
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
            ["▦", "Tổng quan", "overview", true],
            ["◈", "Quản lý đồ uống", "drinks", canManageProducts],
            ["♙", "Quản lý nhân viên", "employees", canManageEmployees],
            ["＋", "Tạo đơn tại quầy", "counter-order", isAdmin || isSeller || isCashier],
            ["☷", "Quản lý đơn hàng", "orders", true],
            ["↗", "Báo cáo doanh thu", "revenue", isAdmin || isCashier],
            ["★", "Đồ uống bán chạy", "popular", isAdmin || isSeller],
            ["₫", "Tổng hợp chi tiêu", "expenses", isAdmin || isCashier],
            ["♙", "Thông tin tài khoản", "my-profile", true]
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
        popularPanel.innerHTML = `<section class="revenue-placeholder"><p class="eyebrow">BÁO CÁO SẢN PHẨM</p><h2>Đồ uống bán chạy</h2><p>Khu vực báo cáo sẽ được kết nối với dữ liệu đơn hàng hoàn tất ở bước tiếp theo.</p></section>`;
        panels.append(popularPanel);
        expensePanel = document.createElement("section");
        expensePanel.className = "admin-panel";
        expensePanel.dataset.panel = "expenses";
        expensePanel.hidden = true;
        expensePanel.innerHTML = `<section class="revenue-placeholder"><p class="eyebrow">QUẢN LÝ CHI PHÍ</p><h2>Tổng hợp chi tiêu</h2><p>Khu vực tổng hợp chi tiêu sẽ được xây dựng ở bước báo cáo tiếp theo.</p></section>`;
        panels.append(expensePanel);
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
    app.append(workspace);

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
        onUpdateStatus: (id, status) => orderService.updateStatus(id, status),
        onUpdatePayment: (id, status) => orderService.updatePayment(id, status),
        onRefresh: () => orderService.getStaffOrders()
    });

    const counterOrderView = new CounterOrderView(counterPanel, {
        onLoadProducts: () => productService.getAllProducts(),
        onCreateOrder: (order) => orderService.createCounterOrder(order),
        onCreated: () => orderView.refresh(),
        onSimulateQrPayment: (id) => orderService.updatePayment(id, "paid")
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
        overview: ["Tổng quan", isSeller ? "Theo dõi đơn hàng và mặt hàng được khách lựa chọn." : "Theo dõi nhanh tình hình hoạt động của ONCafe."],
        "counter-order": ["Tạo đơn tại quầy", "Tạo đơn bán hàng, kiểm tra tồn kho và ghi nhận phương thức thanh toán."],
        drinks: ["Quản lý đồ uống", "Danh sách, thông tin và số lượng đồ uống trong quán."],
        employees: ["Quản lý nhân viên", "Quản lý tài khoản và thông tin nhân viên."],
        revenue: ["Báo cáo doanh thu", "Báo cáo doanh thu và hiệu quả kinh doanh."],
        popular: ["Đồ uống bán chạy", "Theo dõi các sản phẩm được khách hàng lựa chọn nhiều nhất."],
        expenses: ["Tổng hợp chi tiêu", "Theo dõi các khoản chi phí hoạt động của quán."],
        orders: ["Quản lý đơn hàng", "Theo dõi và cập nhật trạng thái đơn hàng."],
        "my-profile": ["Thông tin tài khoản", "Cập nhật thông tin cá nhân và mật khẩu đăng nhập."]
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
        if (sectionName === "drinks" && canManageProducts) loadProducts();
        if (sectionName === "employees" && canManageEmployees) loadEmployees();
        if (sectionName === "orders") loadOrders();
        if (sectionName === "counter-order") void counterOrderView.render();
        if (sectionName === "overview" && isSeller) loadSellerOverview();
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

    async function loadSellerOverview() {
        const chart = dashboardPanel.querySelector("[data-seller-sales-chart]");
        if (!chart) return;
        chart.replaceChildren();
        const loading = document.createElement("p");
        loading.setAttribute("role", "status");
        loading.textContent = "Đang tải thống kê bán hàng...";
        chart.append(loading);

        try {
            const orders = await orderService.getStaffOrders();
            const completedOrders = orders.filter((order) => order.status === "completed");
            const salesByProduct = new Map();
            for (const order of completedOrders) {
                for (const item of Array.isArray(order.items) ? order.items : []) {
                    const name = String(item.product_name || "Đồ uống không tên");
                    const quantity = Number(item.quantity);
                    if (!Number.isFinite(quantity) || quantity <= 0) continue;
                    salesByProduct.set(name, (salesByProduct.get(name) || 0) + quantity);
                }
            }

            const totalUnitsSold = [...salesByProduct.values()].reduce((total, quantity) => total + quantity, 0);
            dashboardPanel.querySelector("[data-seller-order-count]").textContent = String(orders.length);
            dashboardPanel.querySelector("[data-seller-completed-count]").textContent = String(completedOrders.length);
            dashboardPanel.querySelector("[data-seller-units-sold]").textContent = String(totalUnitsSold);

            const topProducts = [...salesByProduct.entries()]
                .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], "vi"))
                .slice(0, 5);
            chart.replaceChildren();
            if (!topProducts.length) {
                const empty = document.createElement("p");
                empty.className = "seller-sales-empty";
                empty.textContent = "Chưa có đồ uống nào được bán trong đơn hàng hoàn tất.";
                chart.append(empty);
                return;
            }

            const maxQuantity = topProducts[0][1];
            for (const [name, quantity] of topProducts) {
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
        } catch (error) {
            console.error("Không thể tải thống kê bán hàng:", error);
            chart.replaceChildren();
            const message = document.createElement("p");
            message.className = "app-error";
            message.setAttribute("role", "alert");
            message.textContent = error.message || "Không thể tải thống kê bán hàng.";
            chart.append(message);
        }
    }

    activateSection("overview");
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
