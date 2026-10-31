import { CustomerMenuRepository } from "../../repositories/CustomerMenuRepo.js";
import { CustomerOrderRepository } from "../../repositories/CustomerOrderRepo.js";
import { CustomerMenuService } from "../../services/CustomerMenuService.js";
import { CustomerCheckoutService } from "../../services/CustomerCheckoutService.js";
import { ValidationUtils } from "../../validators/ValidationUtils.js";
import { OrderValidator } from "../../validators/OrderValidator.js";
import { ValidationUI } from "../../validators/ValidationUI.js";
import { showPaymentConfirmedPopup, showOrderSuccessPopup } from "./ui/OrderDialogs.js";

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
let cart = loadCart();

function loadCart() {
    try {
        const savedCart = JSON.parse(localStorage.getItem("oncafe-cart") || "[]");
        return Array.isArray(savedCart) ? savedCart : [];
    } catch {
        return [];
    }
}

function saveCart() {
    localStorage.setItem("oncafe-cart", JSON.stringify(cart));
    renderCart();
}

function showStatus(message, isError = false) {
    if (!menuStatus) return;
    menuStatus.textContent = message;
    menuStatus.classList.toggle("menu-status-error", isError);
    menuStatus.hidden = false;
}

function createMenuCard(product) {
    const card = document.createElement("article");
    card.className = "menu-card";

    const imageFrame = document.createElement("div");
    imageFrame.className = "menu-card-image";

    const image = document.createElement("img");
    image.src = product.image_url || "../assets/images/bac-xiu.jpg";
    image.alt = product.name ? `Ảnh ${product.name}` : "Ảnh đồ uống";
    image.loading = "lazy";
    image.addEventListener("error", () => {
        image.src = "../assets/images/bac-xiu.jpg";
    }, { once: true });

    const stock = document.createElement("span");
    stock.className = `menu-card-stock${Number(product.quantity) > 0 ? "" : " menu-card-stock-empty"}`;
    stock.textContent = Number(product.quantity) > 0
        ? `Còn ${Number(product.quantity)} phần`
        : "Tạm hết hàng";
    imageFrame.append(image, stock);

    const content = document.createElement("div");
    content.className = "menu-card-content";

    const category = document.createElement("p");
    category.className = "menu-card-category";
    category.textContent = product.categories?.name || "Đồ uống";

    const name = document.createElement("h2");
    name.textContent = product.name || "Sản phẩm";

    const price = document.createElement("p");
    price.className = "menu-card-price";
    price.textContent = currencyFormatter.format(Number(product.price) || 0);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "menu-add-button";
    addButton.textContent = Number(product.quantity) > 0 ? "Thêm vào giỏ" : "Tạm hết hàng";
    addButton.disabled = Number(product.quantity) <= 0;
    addButton.addEventListener("click", () => addToCart(product.id));

    content.append(category, name, price, addButton);
    card.append(imageFrame, content);
    return card;
}

function addToCart(productId) {
    const product = availableProducts.find((item) => item.id === productId);
    if (!product) return;

    const existingItem = cart.find((item) => item.id === productId);
    if (existingItem) {
        if (existingItem.quantity >= Number(product.quantity)) {
            showStatus(`Số lượng ${product.name} trong giỏ đã đạt tồn kho hiện tại.`, true);
            return;
        }
        existingItem.quantity += 1;
    } else {
        if (Number(product.quantity) < 1) return;
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            image_url: product.image_url || "",
            quantity: 1
        });
    }

    saveCart();
}

function changeQuantity(productId, amount) {
    const item = cart.find((cartItem) => cartItem.id === productId);
    if (!item) return;
    const product = availableProducts.find((available) => available.id === productId);
    if (amount > 0 && product && item.quantity >= Number(product.quantity)) {
        showStatus(`Số lượng ${product.name} đã đạt tồn kho hiện tại.`, true);
        return;
    }

    item.quantity += amount;
    if (item.quantity <= 0) {
        cart = cart.filter((cartItem) => cartItem.id !== productId);
    }

    saveCart();
}

function removeFromCart(productId) {
    cart = cart.filter((item) => item.id !== productId);
    saveCart();
}

function renderCart() {
    if (!cartItems || !cartTotal || !cartCount) return;

    cartItems.replaceChildren();
    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    cartCount.textContent = String(totalQuantity);
    cartTotal.textContent = currencyFormatter.format(totalPrice);

    if (cart.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "cart-empty";
        emptyMessage.textContent = "Giỏ hàng đang trống. Hãy chọn đồ uống bạn thích.";
        cartItems.append(emptyMessage);
        updateCheckoutSummary();
        return;
    }

    cart.forEach((item) => {
        const row = document.createElement("div");
        row.className = "cart-item";

        const details = document.createElement("div");
        details.className = "cart-item-details";

        const name = document.createElement("strong");
        name.textContent = item.name;

        const price = document.createElement("span");
        price.textContent = currencyFormatter.format(item.price * item.quantity);
        details.append(name, price);

        const controls = document.createElement("div");
        controls.className = "cart-item-controls";

        const decreaseButton = document.createElement("button");
        decreaseButton.type = "button";
        decreaseButton.className = "cart-quantity-button";
        decreaseButton.textContent = "−";
        decreaseButton.setAttribute("aria-label", `Giảm số lượng ${item.name}`);
        decreaseButton.addEventListener("click", () => changeQuantity(item.id, -1));

        const quantity = document.createElement("span");
        quantity.className = "cart-quantity";
        quantity.textContent = String(item.quantity);

        const increaseButton = document.createElement("button");
        increaseButton.type = "button";
        increaseButton.className = "cart-quantity-button";
        increaseButton.textContent = "+";
        increaseButton.setAttribute("aria-label", `Tăng số lượng ${item.name}`);
        increaseButton.addEventListener("click", () => changeQuantity(item.id, 1));

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "cart-remove-button";
        removeButton.textContent = "Bỏ";
        removeButton.addEventListener("click", () => removeFromCart(item.id));

        controls.append(decreaseButton, quantity, increaseButton, removeButton);
        row.append(details, controls);
        cartItems.append(row);
    });
    updateCheckoutSummary();
}

async function loadMenu() {
    if (!menuGrid) return;

    showStatus("Đang tải thực đơn...");
    menuGrid.replaceChildren();

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
        menuGrid.append(...availableProducts.map(createMenuCard));
        menuStatus.hidden = true;
    }

    renderCart();
}

const checkoutButton = document.querySelector("#checkoutButton");
const checkoutForm = document.querySelector("#checkoutForm");
const checkoutMessage = document.querySelector("#checkoutMessage");
const submitOrderButton = document.querySelector("#submitOrderButton");
const fulfillmentSelect = checkoutForm?.querySelector('[name="fulfillmentMethod"]');
const addressInput = checkoutForm?.querySelector('[name="address"]');
const paymentSelect = checkoutForm?.querySelector('[name="paymentMethod"]');
const checkoutTotalSummary = document.querySelector("#checkoutTotalSummary");
ValidationUI.bind(checkoutForm);

function updateCheckoutSummary() {
    if (!checkoutTotalSummary) return;
    const productTotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const isDelivery = fulfillmentSelect?.value === "delivery";
    const deliveryFee = isDelivery ? 15000 : 0;
    checkoutTotalSummary.textContent = `Tạm tính: ${currencyFormatter.format(productTotal)} · Phí giao hàng: ${currencyFormatter.format(deliveryFee)} · Tổng: ${currencyFormatter.format(productTotal + deliveryFee)}`;
    if (addressInput) {
        addressInput.required = true;
        addressInput.minLength = isDelivery ? 20 : 1;
        addressInput.placeholder = isDelivery
            ? "Nhập đầy đủ số nhà, tên đường/thôn xóm, phường/xã, quận/huyện và tỉnh/thành phố"
            : "Nhập địa chỉ hiện tại hoặc địa chỉ liên hệ";
    }
    if (paymentSelect) paymentSelect.value = "qr";
}

fulfillmentSelect?.addEventListener("change", updateCheckoutSummary);



let paymentWatchTimer = null;
let paymentWatchBusy = false;

function watchQrPayment(orderId) {
    if (paymentWatchTimer) window.clearInterval(paymentWatchTimer);

    paymentWatchTimer = window.setInterval(async () => {
        if (document.hidden || paymentWatchBusy) return;
        paymentWatchBusy = true;

        try {
            const order = await customerCheckoutService.getOrderPaymentState(orderId);

            if (order?.payment_status === "paid") {
                window.clearInterval(paymentWatchTimer);
                paymentWatchTimer = null;
                showPaymentConfirmedPopup(order, currencyFormatter);
            } else if (order && ["cancelled", "rejected"].includes(order.status)) {
                window.clearInterval(paymentWatchTimer);
                paymentWatchTimer = null;
                showCheckoutMessage("Đơn hàng đã kết thúc trước khi thanh toán được xác nhận. Vui lòng kiểm tra mục Đơn hàng của tôi.", true);
            }
        } catch (error) {
            console.warn("Chưa thể kiểm tra trạng thái thanh toán:", error);
        } finally {
            paymentWatchBusy = false;
        }
    }, 5000);
}

function showCheckoutMessage(message, isError = false) {
    if (!checkoutMessage) return;
    checkoutMessage.textContent = message;
    checkoutMessage.classList.toggle("checkout-message-error", isError);
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

        const fullNameInput = checkoutForm.querySelector('[name="fullName"]');
        if (!fullNameInput.value.trim()) fullNameInput.value = user.user_metadata?.full_name || "";
        const profile = await customerCheckoutService.getCustomerProfile(user.id);
        if (profile) {
            if (!fullNameInput.value.trim()) fullNameInput.value = profile.full_name || "";
            const phoneInput = checkoutForm.querySelector('[name="phone"]');
            if (phoneInput && !phoneInput.value) phoneInput.value = profile.phone || "";
            if (addressInput && !addressInput.value) addressInput.value = profile.address || "";
        }

        checkoutForm.hidden = false;
        updateCheckoutSummary();
        checkoutForm.scrollIntoView({ behavior: "smooth", block: "start" });
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

        submitOrderButton.disabled = true;
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

            cart = [];
            saveCart();
            checkoutForm.reset();
            checkoutForm.hidden = true;
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
            submitOrderButton.disabled = false;
        }
    });
}

loadMenu();

window.addEventListener("beforeunload", () => {
    if (paymentWatchTimer) window.clearInterval(paymentWatchTimer);
});
