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

    if (canManageProducts) {
        productPanel = document.createElement("section");
        productPanel.className = "app-panel";
        productPanel.dataset.panel = "products";
        productPanel.hidden = true;
        panels.append(productPanel);
        tabs.append(createButton("Sản phẩm & kho", "products"));
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
