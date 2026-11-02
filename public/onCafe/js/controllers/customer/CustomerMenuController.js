import { CustomerMenuRepository } from "../../repositories/CustomerMenuRepo.js";
import { CustomerOrderRepository } from "../../repositories/CustomerOrderRepo.js";
import { CustomerMenuService } from "../../services/CustomerMenuService.js";
import { CustomerCheckoutService } from "../../services/CustomerCheckoutService.js";
import { CustomerCartService } from "../../services/CustomerCartService.js";
import { CustomerMenuView } from "../../views/customer/CustomerMenuView.js";
import { CustomerCheckoutController } from "./CustomerCheckoutController.js";

const customerMenuService = new CustomerMenuService(new CustomerMenuRepository());
const customerCheckoutService = new CustomerCheckoutService(new CustomerOrderRepository());

const menuGrid = document.querySelector("#menuGrid");
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

function refreshCart() {
    cart = customerCartService.getItems();
    renderCart();
}

const customerMenuView = new CustomerMenuView({
    menuGrid,
    menuStatus,
    cartItems,
    cartTotal,
    cartCount,
    currencyFormatter,
    onAddToCart: addToCart,
    onChangeQuantity: changeQuantity,
    onRemoveFromCart: removeFromCart
});

function showStatus(message, isError = false) {
    customerMenuView.showStatus(message, isError);
}

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

function changeQuantity(productId, amount) {
    const product = availableProducts.find((item) => item.id === productId);

    try {
        customerCartService.changeQuantity(productId, amount, product);
        refreshCart();
    } catch (error) {
        showStatus(error.message, true);
    }
}

function removeFromCart(productId) {
    customerCartService.removeProduct(productId);
    refreshCart();
}

function renderCart() {
    customerMenuView.renderCart(
        cart,
        customerCartService.getTotalQuantity(),
        customerCartService.getSubtotal()
    );
    customerCheckoutController.updateSummary();
}

async function loadMenu() {
    if (!menuGrid) return;

    showStatus("Đang tải thực đơn...");
    customerMenuView.clearMenu();

    try {
        availableProducts = await customerMenuService.getAvailableProducts();
    } catch (error) {
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
