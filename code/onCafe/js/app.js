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
const dashboardHomeLink = document.querySelector("#dashboardHomeLink");

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
    if (dashboardHomeLink) {
        dashboardHomeLink.textContent = isSeller ? "Trang chủ Seller" : isAdmin ? "Trang chủ Admin" : "Trang tổng quan";
        dashboardHomeLink.hidden = false;
    }

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
        </section>` : isCashier ? `
        <section class="dashboard-welcome cashier-dashboard-welcome">
            <p class="eyebrow">KHU VỰC THU NGÂN</p>
            <h2 data-dashboard-greeting></h2>
            <p>Theo dõi đơn hàng trong ca, xác nhận đơn mới và kiểm soát các khoản thanh toán.</p>
        </section>
        <section class="dashboard-metrics cashier-dashboard-metrics" aria-label="Tình hình đơn hàng trong ngày">
            <article class="dashboard-metric"><span>Đơn hàng hôm nay</span><strong data-cashier-today-count>—</strong><small>Tất cả nguồn đơn</small></article>
            <article class="dashboard-metric"><span>Chờ xác nhận</span><strong data-cashier-pending-count>—</strong><small>Cần tiếp nhận xử lý</small></article>
            <article class="dashboard-metric"><span>Đang xử lý</span><strong data-cashier-active-count>—</strong><small>Đã xác nhận đến đang giao</small></article>
            <article class="dashboard-metric"><span>Chưa thanh toán</span><strong data-cashier-unpaid-count>—</strong><small>Đơn chưa ghi nhận thanh toán</small></article>
        </section>
        <section class="dashboard-shortcuts cashier-dashboard-shortcuts">
            <h3>Thao tác nhanh</h3>
            <div>
                <button class="dashboard-shortcut" type="button" data-open-section="counter-order"><span aria-hidden="true">＋</span> Tạo đơn tại quầy <b aria-hidden="true">→</b></button>
                <button class="dashboard-shortcut" type="button" data-open-section="orders"><span aria-hidden="true">☷</span> Quản lý đơn hàng <b aria-hidden="true">→</b></button>
            </div>
        </section>` : `
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
        onMarkArrived: (id) => orderService.markDeliveryArrived(id),
        onRefresh: () => orderService.getStaffOrders()
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
        revenue: ["Báo cáo doanh thu", "Báo cáo doanh thu và hiệu quả kinh doanh."],
        popular: ["Đồ uống bán chạy", "Theo dõi các sản phẩm được khách hàng lựa chọn nhiều nhất."],
        expenses: ["Tổng hợp chi tiêu", "Theo dõi các khoản chi phí hoạt động của quán."],
        orders: ["Quản lý đơn hàng", "Theo dõi và cập nhật trạng thái đơn hàng."],
        "my-profile": ["Thông tin tài khoản", "Cập nhật thông tin cá nhân và mật khẩu đăng nhập."]
    };

    let orderRefreshTimer = null;

    function activateSection(sectionName) {
        if (!sectionDetails[sectionName]) return;
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
        if (sectionName === "counter-order") void counterOrderView.render();
        if (sectionName === "overview" && isSeller) loadSellerOverview();
        if (sectionName === "overview" && isCashier) loadCashierOverview();
        if (sectionName === "popular" && (isAdmin || isSeller)) loadPopularDrinks();
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

    async function loadPopularDrinks() {
        const chart = popularPanel.querySelector("[data-popular-drinks]");
        if (!chart) return;

        chart.replaceChildren();
        const loading = document.createElement("p");
        loading.setAttribute("role", "status");
        loading.textContent = "Đang tải dữ liệu đồ uống bán chạy...";
        chart.append(loading);

        try {
            const orders = await orderService.getStaffOrders();
            const completedOrders = orders.filter((order) => order.status === "completed");
            const salesByProduct = new Map();

            for (const order of completedOrders) {
                for (const item of Array.isArray(order.items) ? order.items : []) {
                    const name = String(item.product_name || "Đồ uống không tên").trim();
                    const quantity = Number(item.quantity);
                    if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;

                    const unitPrice = Number(item.unit_price) || 0;
                    const subtotal = Number(item.subtotal);
                    const revenue = Number.isFinite(subtotal) && subtotal >= 0
                        ? subtotal
                        : unitPrice * quantity;
                    const current = salesByProduct.get(name) || { quantity: 0, revenue: 0 };
                    current.quantity += quantity;
                    current.revenue += revenue;
                    salesByProduct.set(name, current);
                }
            }

            const products = [...salesByProduct.entries()]
                .sort((first, second) =>
                    second[1].quantity - first[1].quantity ||
                    second[1].revenue - first[1].revenue ||
                    first[0].localeCompare(second[0], "vi")
                )
                .slice(0, 10);
            const totalUnits = [...salesByProduct.values()]
                .reduce((total, product) => total + product.quantity, 0);

            popularPanel.querySelector("[data-popular-order-count]").textContent = String(completedOrders.length);
            popularPanel.querySelector("[data-popular-units]").textContent = String(totalUnits);
            popularPanel.querySelector("[data-popular-product-count]").textContent = String(salesByProduct.size);

            chart.replaceChildren();
            if (!products.length) {
                const empty = document.createElement("p");
                empty.className = "seller-sales-empty";
                empty.textContent = "Chưa có đơn hàng hoàn tất có đồ uống để thống kê. Khi đơn hàng được chuyển sang Hoàn tất, dữ liệu sẽ xuất hiện tại đây.";
                chart.append(empty);
                return;
            }

            const maxQuantity = products[0][1].quantity;
            const currencyFormatter = new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
                maximumFractionDigits: 0
            });

            for (const [name, sales] of products) {
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
        } catch (error) {
            console.error("Không thể tải đồ uống bán chạy:", error);
            chart.replaceChildren();
            const message = document.createElement("p");
            message.className = "app-error";
            message.setAttribute("role", "alert");
            message.textContent = error.message || "Không thể tải dữ liệu đồ uống bán chạy.";
            chart.append(message);
        }
    }

    async function loadCashierOverview() {
        const metricSelectors = [
            "[data-cashier-today-count]",
            "[data-cashier-pending-count]",
            "[data-cashier-active-count]",
            "[data-cashier-unpaid-count]"
        ];
        const metrics = metricSelectors.map((selector) => dashboardPanel.querySelector(selector));
        if (metrics.some((element) => !element)) return;
        metrics.forEach((element) => { element.textContent = "…"; });

        try {
            const orders = await orderService.getStaffOrders();
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
            const todayOrders = orders.filter((order) => {
                const createdAt = new Date(order.created_at).getTime();
                return Number.isFinite(createdAt) && createdAt >= todayStart && createdAt < tomorrowStart;
            });
            const pendingOrders = todayOrders.filter((order) => order.status === "pending");
            const activeOrders = todayOrders.filter((order) =>
                ["confirmed", "preparing", "ready_for_pickup", "delivering"].includes(order.status)
            );
            const unpaidOrders = todayOrders.filter((order) =>
                order.payment_status === "unpaid" && !["cancelled", "rejected"].includes(order.status)
            );

            metrics[0].textContent = String(todayOrders.length);
            metrics[1].textContent = String(pendingOrders.length);
            metrics[2].textContent = String(activeOrders.length);
            metrics[3].textContent = String(unpaidOrders.length);
        } catch (error) {
            console.error("Không thể tải tổng quan thu ngân:", error);
            metrics.forEach((element) => { element.textContent = "—"; });
            const existingMessage = dashboardPanel.querySelector("[data-cashier-overview-error]");
            if (existingMessage) existingMessage.remove();
            const message = document.createElement("p");
            message.className = "app-error";
            message.dataset.cashierOverviewError = "";
            message.setAttribute("role", "alert");
            message.textContent = error.message || "Không thể tải số liệu đơn hàng. Vui lòng thử lại.";
            dashboardPanel.querySelector(".cashier-dashboard-welcome")?.after(message);
        }
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
