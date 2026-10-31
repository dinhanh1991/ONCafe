import { CustomerMenuRepository } from "../../repositories/CustomerMenuRepo.js";
import { CustomerOrderRepository } from "../../repositories/CustomerOrderRepo.js";
import { CustomerMenuService } from "../../services/CustomerMenuService.js";
import { CustomerCheckoutService } from "../../services/CustomerCheckoutService.js";
import { CustomerCartService } from "../../services/CustomerCartService.js";
import { CustomerMenuView } from "../../views/customer/CustomerMenuView.js";
import { CustomerCheckoutView } from "../../views/customer/CustomerCheckoutView.js";
import { ValidationUtils } from "../../validators/ValidationUtils.js";
import { OrderValidator } from "../../validators/OrderValidator.js";
import { ValidationUI } from "../../validators/ValidationUI.js";
import { showPaymentConfirmedPopup, showOrderSuccessPopup } from "../../ui/customer/OrderDialogs.js";
import { CustomerPaymentMonitor } from "./CustomerPaymentMonitor.js";

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
    updateCheckoutSummary();
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

const checkoutButton = document.querySelector("#checkoutButton");
const checkoutForm = document.querySelector("#checkoutForm");
const checkoutMessage = document.querySelector("#checkoutMessage");
const checkoutView = new CustomerCheckoutView({
    form: checkoutForm,
    message: checkoutMessage,
    totalSummary: document.querySelector("#checkoutTotalSummary"),
    currencyFormatter
});
ValidationUI.bind(checkoutForm);

function updateCheckoutSummary() {
    checkoutView.updateSummary(customerCartService.getSubtotal());
}

checkoutView.bindFulfillmentChange(updateCheckoutSummary);

const customerPaymentMonitor = new CustomerPaymentMonitor({
    getPaymentState: (orderId) => customerCheckoutService.getOrderPaymentState(orderId),
    onPaid: (order) => showPaymentConfirmedPopup(order, currencyFormatter),
    onEnded: () => showCheckoutMessage(
        "Đơn hàng đã kết thúc trước khi thanh toán được xác nhận. Vui lòng kiểm tra mục Đơn hàng của tôi.",
        true
    )
});

function watchQrPayment(orderId) {
    customerPaymentMonitor.start(orderId);
}

function showCheckoutMessage(message, isError = false) {
    checkoutView.showMessage(message, isError);
}

if (checkoutButton && checkoutForm) {
    checkoutButton.addEventListener("click", async () => {
        if (cart.length === 0) {
            showStatus("Giỏ hàng đang trống. Hãy thêm ít nhất một đồ uống trước.", true);
            return;
        }

        let user;
        try {
            user = await customerCheckoutService.getCurrentUser();
        } catch {
            user = null;
        }
        if (!user) {
            showStatus("Bạn cần đăng nhập trước khi đặt hàng. Hãy đăng nhập rồi quay lại thực đơn.", true);
            window.location.href = "../auth/login.html?redirect=menu";
            return;
        }

        const profile = await customerCheckoutService.getCustomerProfile(user.id);
        checkoutView.showForm(user, profile);
        updateCheckoutSummary();
        showCheckoutMessage("Vui lòng kiểm tra thông tin và xác nhận đơn hàng.");
    });
}

if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (cart.length === 0) {
            showCheckoutMessage("Giỏ hàng đang trống. Hãy chọn lại sản phẩm.", true);
            return;
        }

        let currentUser;
        try {
            currentUser = await customerCheckoutService.getCurrentUser();
        } catch {
            currentUser = null;
        }
        if (!currentUser) {
            showCheckoutMessage("Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.", true);
            return;
        }

        const formData = new FormData(checkoutForm);
        const fulfillmentMethod = String(formData.get("fulfillmentMethod") || "pickup");
        const paymentMethod = "qr";
        const fullName = String(formData.get("fullName") || "").trim();
        const phone = ValidationUtils.normalizeVietnamPhone(formData.get("phone"));
        const address = String(formData.get("address") || "").trim();

        const fieldErrors = {};
        if (fullName.length < 2) {
            fieldErrors.fullName = "Vui lòng nhập đầy đủ họ và tên người nhận.";
        }
        if (!phone || !ValidationUtils.isValidVietnamPhone(phone)) {
            fieldErrors.phone = "Số điện thoại chưa hợp lệ. Hãy nhập số di động Việt Nam gồm 10 chữ số hoặc dạng +84.";
        }
        if (!address) {
            fieldErrors.address = "Vui lòng nhập địa chỉ.";
        } else if (fulfillmentMethod === "delivery" && address.length < 20) {
            fieldErrors.address = "Địa chỉ giao hàng chưa đầy đủ. Nhập số nhà/đường hoặc thôn xóm, phường/xã, quận/huyện và tỉnh/thành phố.";
        }
        if (Object.keys(fieldErrors).length) {
            ValidationUI.showErrors(checkoutForm, fieldErrors);
            showCheckoutMessage("");
            return;
        }
        ValidationUI.clearErrors(checkoutForm);
        const items = cart.map((item) => ({
            id: item.id,
            quantity: item.quantity
        }));
        const itemValidation = OrderValidator.validateItems(items);
        if (!itemValidation.isValid) {
            showCheckoutMessage(itemValidation.errors.items, true);
            return;
        }

        checkoutView.setSubmitting(true);
        showCheckoutMessage("Đang gửi đơn hàng lên hệ thống...");

        try {
            const order = await customerCheckoutService.createOrder({
                fullName,
                phone,
                address,
                paymentMethod,
                fulfillmentMethod,
                items
            });
            if (!order?.order_code) {
                throw new Error("Hệ thống chưa trả về mã đơn hàng. Vui lòng kiểm tra mục đơn hàng trước khi đặt lại.");
            }

            customerCartService.clear();
            refreshCart();
            checkoutView.resetForm();
            checkoutView.hideForm();
            updateCheckoutSummary();
            showCheckoutMessage("");

            let qrInfo;
            try {
                qrInfo = await customerCheckoutService.createQrInfo(order.order_id, window.location.href);
            } catch (qrError) {
                const message = `Đơn ${order.order_code} đã được tạo nhưng chưa tạo được mã QR. Không đặt lại đơn; vui lòng vào Đơn hàng của tôi để tạo lại mã. ${qrError.message || ""}`;
                showStatus(message, true);
                showOrderSuccessPopup(
                    { ...order, delivery_fee: fulfillmentMethod === "delivery" ? 15000 : 0 },
                    paymentMethod,
                    fulfillmentMethod,
                    { error: message },
                    currencyFormatter
                );
                return;
            }

            showStatus(`Đã tạo đơn ${order.order_code}. Vui lòng thanh toán QR trong 10 phút.`);
            showOrderSuccessPopup({ ...order, delivery_fee: fulfillmentMethod === "delivery" ? 15000 : 0 }, paymentMethod, fulfillmentMethod, qrInfo, currencyFormatter);
            if (paymentMethod === "qr") watchQrPayment(order.order_id);
        } catch (error) {
            console.error("Lỗi đặt hàng ONCafe:", error);
            showCheckoutMessage(error.message || "Không thể tạo đơn hàng. Vui lòng thử lại.", true);
        } finally {
            checkoutView.setSubmitting(false);
        }
    });
}

loadMenu();

window.addEventListener("beforeunload", () => {
    customerPaymentMonitor.stop();
});
