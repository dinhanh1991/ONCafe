import { ProductRepository } from "./repositories/ProductRepo.js";
import { ProductService } from "./services/ProductService.js";
import { ProductView } from "./views/ProductView.js";

const productRepository = new ProductRepository();
const productService = new ProductService(productRepository);
const app = document.querySelector("#app");

async function startApp() {
    if (!app) throw new Error("Không tìm thấy phần tử #app trong trang.");

    const productView = new ProductView(app, {
        onSave: (product) => product.id === undefined
            ? productService.addProduct(product)
            : productService.updateProduct(product.id, product),
        onDelete: (id) => productService.deleteProduct(id)
    });

    productView.render(await productService.getAllProducts());
}

startApp().catch((error) => {
    console.error("Không thể khởi chạy ONCafe:", error);
    const app = document.querySelector("#app");
    if (app) app.innerHTML = '<p class="app-error" role="alert">Không thể tải ứng dụng. Vui lòng tải lại trang.</p>';
});
