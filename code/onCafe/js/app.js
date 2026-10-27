import { supabase } from "./config/supabase.js";
import { AuthService } from "./services/AuthService.js";
import { ProductRepository } from "./repositories/ProductRepo.js";
import { ProductService } from "./services/ProductService.js";
import { ProductView } from "./views/ProductView.js";

const authService = new AuthService();
const productRepository = new ProductRepository();
const productService = new ProductService(productRepository);
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

async function startApp() {
    if (!app) throw new Error("Không tìm thấy phần tử #app trong trang.");

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const session = sessionData.session;
    if (!session) {
        showMessage("Bạn cần đăng nhập bằng tài khoản Admin để quản lý sản phẩm.");
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", session.user.id)
        .single();

    if (profileError) throw profileError;

    if (profile.role !== "admin") {
        showMessage("Tài khoản này không có quyền quản lý sản phẩm.", true);
        return;
    }

    const accountLabel = document.querySelector("#accountLabel");
    if (accountLabel) accountLabel.textContent = `Xin chào, ${profile.full_name}`;
    if (logoutButton) logoutButton.hidden = false;

    const productView = new ProductView(app, {
        onSave: (product) => product.id === undefined
            ? productService.addProduct(product)
            : productService.updateProduct(product.id, product),
        onDelete: (id) => productService.deleteProduct(id)
    });

    productView.render(await productService.getAllProducts());
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
