import { supabase } from "./config/supabase.js";

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

    const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, is_available, quantity, categories(name)")
        .eq("is_available", true)
        .order("name", { ascending: true });

    if (error) {
        console.error("Không thể tải thực đơn ONCafe:", error);
        showStatus(
            "Chưa tải được thực đơn. Vui lòng thử tải lại trang. Nếu lỗi vẫn còn, cần kiểm tra quyền đọc bảng products trong Supabase (RLS).",
            true
        );
        renderCart();
        return;
    }

    availableProducts = data || [];
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

function updateCheckoutSummary() {
    if (!checkoutTotalSummary) return;
    const productTotal = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const isDelivery = fulfillmentSelect?.value === "delivery";
    const deliveryFee = isDelivery ? 15000 : 0;
    checkoutTotalSummary.textContent = `Tạm tính: ${currencyFormatter.format(productTotal)} · Phí giao hàng: ${currencyFormatter.format(deliveryFee)} · Tổng: ${currencyFormatter.format(productTotal + deliveryFee)}`;
    if (addressInput) {
        addressInput.required = isDelivery;
        addressInput.minLength = isDelivery ? 20 : 0;
        addressInput.placeholder = isDelivery
            ? "Nhập đầy đủ số nhà, tên đường/thôn xóm, phường/xã, quận/huyện và tỉnh/thành phố"
            : "Địa chỉ hoặc ghi chú (không bắt buộc khi nhận tại cửa hàng)";
    }
    if (paymentSelect) {
        const cashOption = paymentSelect.querySelector('option[value="cash"]');
        if (cashOption) cashOption.hidden = isDelivery;
        if (isDelivery) paymentSelect.value = "qr";
    }
}

fulfillmentSelect?.addEventListener("change", updateCheckoutSummary);

async function createCustomerQrInfo(orderId) {
    const { data, error } = await supabase.functions.invoke("oncafe-qr-payment", {
        body: { action: "create", order_id: orderId }
    });
    if (error) throw new Error(data?.error || error.message || "Không tạo được mã QR.");
    if (!data?.token) throw new Error(data?.error || "Không nhận được mã QR.");
    const confirmUrl = new URL("./qr-confirm.html", window.location.href);
    confirmUrl.searchParams.set("token", data.token);
    const qrModule = await import("https://esm.sh/qrcode@1.5.4");
    const QRCode = qrModule.default || qrModule;
    return {
        url: confirmUrl.href,
        image: await QRCode.toDataURL(confirmUrl.href, { width: 220, margin: 2 }),
        expiresAt: data.expires_at
    };
}

function showPaymentConfirmedPopup(order) {
    if (document.querySelector(".payment-success-backdrop")) return;

    const overlay = document.createElement("div");
    overlay.className = "payment-success-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "payment-success-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "menuPaymentSuccessTitle");

    const icon = document.createElement("div");
    icon.className = "payment-success-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✓";

    const title = document.createElement("h2");
    title.id = "menuPaymentSuccessTitle";
    title.textContent = "Thanh toán thành công!";

    const message = document.createElement("p");
    message.textContent = "Cảm ơn quý khách đã mua hàng tại ONCafe. Đơn " + (order.order_code || "") + " đã được xác nhận thanh toán.";

    const total = document.createElement("strong");
    total.className = "payment-success-total";
    total.textContent = currencyFormatter.format(Number(order.total_amount) || 0);

    const trackButton = document.createElement("button");
    trackButton.type = "button";
    trackButton.className = "payment-success-button";
    trackButton.textContent = "Theo dõi đơn hàng";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "menu-order-dialog-secondary";
    closeButton.textContent = "Đóng";

    const close = () => {
        overlay.remove();
        document.removeEventListener("keydown", handleKeydown);
    };
    const handleKeydown = (event) => {
        if (event.key === "Escape") close();
    };

    dialog.append(icon, title, message, total, trackButton, closeButton);
    overlay.append(dialog);
    document.body.append(overlay);
    trackButton.addEventListener("click", () => {
        window.location.href = "./my-orders.html";
    });
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", handleKeydown);
    trackButton.focus();
}

let paymentWatchTimer = null;
let paymentWatchBusy = false;

function watchQrPayment(orderId) {
    if (paymentWatchTimer) window.clearInterval(paymentWatchTimer);

    paymentWatchTimer = window.setInterval(async () => {
        if (document.hidden || paymentWatchBusy) return;
        paymentWatchBusy = true;

        try {
            const { data, error } = await supabase.rpc("oncafe_my_orders");
            if (error) throw error;

            const orders = Array.isArray(data) ? data : [];
            const order = orders.find((item) => String(item.id) === String(orderId));

            if (order?.payment_status === "paid") {
                window.clearInterval(paymentWatchTimer);
                paymentWatchTimer = null;
                showPaymentConfirmedPopup(order);
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

function showOrderSuccessPopup(order, paymentMethod, fulfillmentMethod, qrInfo) {
    const overlay = document.createElement("div");
    overlay.className = "menu-order-dialog-backdrop";

    const dialog = document.createElement("section");
    dialog.className = "menu-order-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "menu-order-dialog-title");
    dialog.setAttribute("aria-describedby", "menu-order-dialog-message");

    const icon = document.createElement("div");
    icon.className = "menu-order-dialog-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✓";

    const title = document.createElement("h2");
    title.id = "menu-order-dialog-title";
    title.textContent = "Đặt hàng thành công";

    const message = document.createElement("p");
    message.id = "menu-order-dialog-message";
    const orderCode = order.order_code;
    const total = currencyFormatter.format(Number(order.total_amount) || 0);
    const deliveryFee = Number(order.delivery_fee) || (fulfillmentMethod === "delivery" ? 15000 : 0);
    const fulfillmentLabel = fulfillmentMethod === "delivery" ? "Giao tận nhà" : "Nhận tại cửa hàng";
    message.textContent = `Đơn ${orderCode} đã được tạo. Hình thức nhận: ${fulfillmentLabel}. Phí giao hàng: ${currencyFormatter.format(deliveryFee)}. Tổng thanh toán: ${total}. Đơn đang chờ quán xác nhận.`;

    let qrPanel = null;
    if (paymentMethod === "qr") {
        qrPanel = document.createElement("div");
        qrPanel.className = "customer-qr-panel";
        const note = document.createElement("p");
        note.textContent = qrInfo?.image
            ? "Quét mã QR để mở trang xác nhận thanh toán. Đây là xác nhận nội bộ mô phỏng, không phải kết nối ngân hàng."
            : `Chưa tạo được mã QR: ${qrInfo?.error || "Vui lòng vào Đơn hàng của tôi hoặc liên hệ cửa hàng để được hỗ trợ."}`;
        qrPanel.append(note);
        if (qrInfo?.image) {
            const image = document.createElement("img");
            image.src = qrInfo.image;
            image.alt = "Mã QR xác nhận thanh toán đơn hàng";
            image.width = 200;
            image.height = 200;
            const link = document.createElement("a");
            link.href = qrInfo.url;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = "Mở trang xác nhận thanh toán";
            const expiry = document.createElement("small");
            expiry.textContent = `Mã có hiệu lực đến ${new Date(qrInfo.expiresAt).toLocaleTimeString("vi-VN")} (15 phút).`;
            qrPanel.append(image, link, expiry);
        }
    }

    const trackButton = document.createElement("button");
    trackButton.type = "button";
    trackButton.className = "menu-add-button";
    trackButton.textContent = "Theo dõi đơn hàng";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "menu-order-dialog-secondary";
    closeButton.textContent = "Tiếp tục xem thực đơn";

    dialog.append(icon, title, message);
    if (qrPanel) dialog.append(qrPanel);
    dialog.append(trackButton, closeButton);
    overlay.append(dialog);
    document.body.append(overlay);

    const close = () => {
        overlay.remove();
        document.removeEventListener("keydown", handleKeydown);
    };
    const handleKeydown = (event) => {
        if (event.key === "Escape") close();
    };

    closeButton.addEventListener("click", close);
    trackButton.addEventListener("click", () => {
        window.location.href = "./my-orders.html";
    });
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", handleKeydown);
    closeButton.focus();
}

if (checkoutButton && checkoutForm) {
    checkoutButton.addEventListener("click", async () => {
        if (cart.length === 0) {
            showStatus("Giỏ hàng đang trống. Hãy thêm ít nhất một đồ uống trước.", true);
            return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
            showStatus("Bạn cần đăng nhập trước khi đặt hàng. Hãy đăng nhập rồi quay lại thực đơn.", true);
            window.location.href = "./login.html?redirect=menu";
            return;
        }

        const user = data.user;
        const fullNameInput = checkoutForm.querySelector('[name="fullName"]');
        if (!fullNameInput.value.trim()) fullNameInput.value = user.user_metadata?.full_name || "";
        const { data: profile } = await supabase.from("profiles")
            .select("full_name, phone, address").eq("id", user.id).maybeSingle();
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

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
            showCheckoutMessage("Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.", true);
            return;
        }

        const formData = new FormData(checkoutForm);
        const fulfillmentMethod = String(formData.get("fulfillmentMethod") || "pickup");
        const paymentMethod = fulfillmentMethod === "delivery"
            ? "qr"
            : String(formData.get("paymentMethod") || "cash");
        const fullName = String(formData.get("fullName") || "").trim();
        const phone = String(formData.get("phone") || "").trim().replace(/[ .()-]/g, "");
        const address = String(formData.get("address") || "").trim();
        const phonePattern = /^(0(?:[35789]\d{8}|2\d{8,9})|[+]84(?:[35789]\d{8}|2\d{8,9}))$/;

        if (fullName.length < 2) {
            showCheckoutMessage("Vui lòng nhập đầy đủ họ và tên người nhận.", true);
            checkoutForm.querySelector('[name="fullName"]')?.focus();
            return;
        }
        if (!phonePattern.test(phone)) {
            showCheckoutMessage("Số điện thoại chưa hợp lệ. Hãy nhập số điện thoại Việt Nam gồm 10–11 chữ số.", true);
            checkoutForm.querySelector('[name="phone"]')?.focus();
            return;
        }
        if (fulfillmentMethod === "delivery" && address.length < 20) {
            showCheckoutMessage("Địa chỉ giao hàng chưa đầy đủ. Vui lòng nhập số nhà/đường hoặc thôn xóm, phường/xã, quận/huyện và tỉnh/thành phố.", true);
            addressInput?.focus();
            return;
        }
        const items = cart.map((item) => ({
            id: item.id,
            quantity: item.quantity
        }));

        submitOrderButton.disabled = true;
        showCheckoutMessage("Đang gửi đơn hàng lên hệ thống...");

        try {
            const { data, error } = await supabase.rpc("oncafe_create_order", {
                p_full_name: fullName,
                p_phone: phone,
                p_address: address,
                p_payment_method: paymentMethod,
                p_fulfillment_method: fulfillmentMethod,
                p_items: items
            });

            if (error) throw error;

            const order = Array.isArray(data) ? data[0] : data;
            if (!order?.order_code) {
                throw new Error("Hệ thống chưa trả về mã đơn hàng. Vui lòng kiểm tra mục đơn hàng trước khi đặt lại.");
            }

            let qrInfo = null;
            if (paymentMethod === "qr") {
                try {
                    qrInfo = await createCustomerQrInfo(order.order_id);
                } catch (qrError) {
                    qrInfo = { error: qrError.message || "Không thể tạo mã QR." };
                }
            }

            cart = [];
            saveCart();
            checkoutForm.reset();
            checkoutForm.hidden = true;
            updateCheckoutSummary();
            showCheckoutMessage("");
            showStatus(`Đã tạo đơn ${order.order_code}.`);
            showOrderSuccessPopup({ ...order, delivery_fee: fulfillmentMethod === "delivery" ? 15000 : 0 }, paymentMethod, fulfillmentMethod, qrInfo);
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
