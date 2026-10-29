import { supabase } from "./config/supabase.js";
import { AuthService } from "./services/AuthService.js";
import { ProductRepository } from "./repositories/ProductRepo.js";
import { ProductService } from "./services/ProductService.js";
import { ProductView } from "./views/ProductView.js";
import { OrderRepository } from "./repositories/OrderRepo.js";
import { OrderService } from "./services/OrderService.js";
import { OrderView } from "./views/OrderView.js";

const authService = new AuthService();
const productService = new ProductService(new ProductRepository());
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

function createButton(label, value) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button app-tab";
    button.textContent = label;
    button.dataset.tab = value;
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
    workspace.className = "staff-workspace";
    const tabs = document.createElement("nav");
    tabs.className = "app-tabs";
    tabs.setAttribute("aria-label", "Khu vực quản lý");
    const panels = document.createElement("div");
    panels.className = "app-panels";
    const orderPanel = document.createElement("section");
    orderPanel.className = "app-panel";
    orderPanel.dataset.panel = "orders";
    const canManageProducts = profile.role === "admin";
    let productPanel = null;
    let productView = null;
    let employeePanel = null;

    if (canManageProducts) {
        productPanel = document.createElement("section");
        productPanel.className = "app-panel";
        productPanel.dataset.panel = "products";
        productPanel.hidden = true;
        panels.append(productPanel);
        tabs.append(createButton("Sản phẩm & kho", "products"));
        employeePanel = document.createElement("section");
        employeePanel.className = "app-panel";
        employeePanel.dataset.panel = "employees";
        employeePanel.hidden = true;
        employeePanel.innerHTML = `
            <section class="employee-manager" aria-labelledby="employee-heading">
                <header class="product-heading">
                    <div><p class="eyebrow">QUẢN TRỊ HỆ THỐNG</p><h2 id="employee-heading">Quản lý nhân viên</h2><p>Mời nhân viên bằng email và gán vai trò thu ngân.</p></div>
                </header>
                <form class="product-form" data-employee-form>
                    <h3>Mời nhân viên mới</h3>
                    <div class="product-form-grid">
                        <label>Họ và tên<input name="fullName" type="text" minlength="2" maxlength="100" autocomplete="name" required></label>
                        <label>Email nhân viên<input name="email" type="email" maxlength="254" autocomplete="email" required></label>
                        <label>Vai trò<select name="role" required><option value="cashier">Thu ngân</option></select></label>
                    </div>
                    <p class="image-help">Nhân viên sẽ nhận email mời để hoàn tất tài khoản. Không nhập hoặc chia sẻ mật khẩu của nhân viên.</p>
                    <div class="form-actions"><button class="button button-primary" type="submit">Gửi lời mời</button></div>
                    <p data-employee-feedback role="status" aria-live="polite"></p>
                </form>
            </section>`;
        panels.append(employeePanel);
        tabs.append(createButton("Quản lý nhân viên", "employees"));
    }
    panels.append(orderPanel);
    tabs.append(createButton("Đơn hàng", "orders"));
    workspace.append(tabs, panels);
    app.append(workspace);

    if (canManageProducts) {
        productView = new ProductView(productPanel, {
            onSave: (product) => product.id === undefined
                ? productService.addProduct(product)
                : productService.updateProduct(product.id, product),
            onDelete: (id) => productService.deleteProduct(id)
        });
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

    if (canManageProducts && employeePanel) {
        const employeeForm = employeePanel.querySelector("[data-employee-form]");
        const employeeFeedback = employeePanel.querySelector("[data-employee-feedback]");
        employeeForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const submitButton = employeeForm.querySelector("button[type=submit]");
            const formData = new FormData(employeeForm);
            const fullName = String(formData.get("fullName") || "").trim();
            const email = String(formData.get("email") || "").trim();
            const role = String(formData.get("role") || "");
            submitButton.disabled = true;
            employeeFeedback.className = "";
            employeeFeedback.textContent = "Đang gửi lời mời...";
            try {
                const { data, error } = await supabase.functions.invoke("admin-create-employee", {
                    body: { fullName, email, role }
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                employeeFeedback.textContent = data?.message || "Đã gửi lời mời nhân viên.";
                employeeForm.reset();
            } catch (error) {
                console.error("Không thể mời nhân viên:", error);
                employeeFeedback.className = "app-error";
                employeeFeedback.textContent = error.message || "Không thể gửi lời mời. Kiểm tra Edge Function đã được triển khai chưa.";
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    function activateTab(tabName) {
        for (const button of tabs.querySelectorAll("[data-tab]")) {
            const active = button.dataset.tab === tabName;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-current", active ? "page" : "false");
        }
        for (const panel of panels.querySelectorAll("[data-panel]")) {
            panel.hidden = panel.dataset.panel !== tabName;
        }
        if (tabName === "products") loadProducts();
        if (tabName === "orders") loadOrders();
    }

    tabs.addEventListener("click", (event) => {
        const button = event.target.closest("[data-tab]");
        if (button) activateTab(button.dataset.tab);
    });
    activateTab("orders");
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
