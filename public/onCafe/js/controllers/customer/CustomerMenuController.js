// Điều phối tải thực đơn và các thao tác với giỏ hàng của khách.
import { CustomerMenuRepository } from "../../repositories/CustomerMenuRepo.js";
import { CustomerOrderRepository } from "../../repositories/CustomerOrderRepo.js";
import { CustomerMenuService } from "../../services/CustomerMenuService.js";
import { CustomerCheckoutService } from "../../services/CustomerCheckoutService.js";
import { CustomerCartService } from "../../services/CustomerCartService.js";
import { CustomerMenuView } from "../../views/customer/CustomerMenuView.js";
import { renderCoffeeLoading, clearCoffeeLoading, waitForCoffeeLoading } from "../../utils/CoffeeLoading.js";
import { CustomerCheckoutController } from "./CustomerCheckoutController.js";

const customerMenuService = new CustomerMenuService(new CustomerMenuRepository());
const customerCheckoutService = new CustomerCheckoutService(new CustomerOrderRepository());

const menuGrid = document.querySelector("#menuGrid");
const menuPagination = document.querySelector("#menuPagination");
const menuStatus = document.querySelector("#menuStatus");
const cartItems = document.querySelector("#cartItems");
const cartTotal = document.querySelector("#cartTotal");
const cartCount = document.querySelector("#cartCount");
const currencyFormatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
});

let availableProducts = [];
const customerCartService = new CustomerCartService();
let cart = customerCartService.getItems();

// Cập nhật hiển thị giỏ hàng theo dữ liệu hiện tại.
function refreshCart() {
    cart = customerCartService.getItems();
    // Cập nhật các món và tổng tiền trong giỏ hàng.
    renderCart();
}

const customerMenuView = new CustomerMenuView({
    menuGrid,
    menuPagination,
    menuStatus,
    cartItems,
    cartTotal,
    cartCount,
    currencyFormatter,
    onAddToCart: addToCart,
    onChangeQuantity: changeQuantity,
    onRemoveFromCart: removeFromCart
});

// Cập nhật thông báo trạng thái trên giao diện.
function showStatus(message, isError = false) {
    const status = document.querySelector("#menuStatus");
    if (message && message.startsWith("Đang")) {
        renderCoffeeLoading(status, message, { compact: true });
    } else {
        clearCoffeeLoading(status);
        customerMenuView.showStatus(message, isError);
    }
}

// Thêm sản phẩm vào giỏ hàng của khách.
function addToCart(productId) {
    const product = availableProducts.find((item) => item.id === productId);
    if (!product) return;

    try {
        customerCartService.addProduct(product);
        refreshCart();
    } catch (error) {
        showStatus(error.message, true);
    }
}

// Thay đổi số lượng món trong giỏ hàng.
function changeQuantity(productId, amount) {
    const product = availableProducts.find((item) => item.id === productId);

    try {
        customerCartService.changeQuantity(productId, amount, product);
        refreshCart();
    } catch (error) {
        showStatus(error.message, true);
    }
}

// Xóa sản phẩm khỏi giỏ hàng.
function removeFromCart(productId) {
    customerCartService.removeProduct(productId);
    // Cập nhật hiển thị giỏ hàng theo dữ liệu hiện tại.
    refreshCart();
}

// Cập nhật các món và tổng tiền trong giỏ hàng.
function renderCart() {
    customerMenuView.renderCart(
        cart,
        customerCartService.getTotalQuantity(),
        customerCartService.getSubtotal()
    );
    customerCheckoutController.updateSummary();
}

// Tải thực đơn và cập nhật giao diện khách hàng.
async function loadMenu() {
    if (!menuGrid) return;

    // Cập nhật thông báo trạng thái trên giao diện.
    showStatus("Đang tải thực đơn...");
    customerMenuView.clearMenu();

    try {
        availableProducts = await customerMenuService.getAvailableProducts();
        await waitForCoffeeLoading(menuStatus);
    } catch (error) {
        await waitForCoffeeLoading(menuStatus);
        console.error("Không thể tải thực đơn ONCafe:", error);
        showStatus(
            "Chưa tải được thực đơn. Vui lòng thử tải lại trang. Nếu lỗi vẫn còn, cần kiểm tra quyền đọc bảng products trong Supabase (RLS).",
            true
        );
        renderCart();
        return;
    }

    if (availableProducts.length === 0) {
        showStatus("Hiện chưa có đồ uống nào được mở bán.");
    } else {
        customerMenuView.renderMenu(availableProducts);
        customerMenuView.hideStatus();
    }

    // Cập nhật các món và tổng tiền trong giỏ hàng.
    renderCart();
}

const customerCheckoutController = new CustomerCheckoutController({
    checkoutService: customerCheckoutService,
    cartService: customerCartService,
    getCartItems: () => customerCartService.getItems(),
    onCartChanged: refreshCart,
    showMenuStatus: showStatus,
    currencyFormatter
});

loadMenu();
