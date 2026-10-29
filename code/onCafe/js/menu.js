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

    const image = document.createElement("img");
    image.src = product.image_url || "../assets/images/bac-xiu.jpg";
    image.alt = product.name ? `Ảnh ${product.name}` : "Ảnh đồ uống";
    image.loading = "lazy";
    image.addEventListener("error", () => {
        image.src = "../assets/images/bac-xiu.jpg";
    }, { once: true });

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
    addButton.textContent = "Thêm vào giỏ";
    addButton.addEventListener("click", () => addToCart(product.id));

    content.append(category, name, price, addButton);
    card.append(image, content);
    return card;
}

function addToCart(productId) {
    const product = availableProducts.find((item) => item.id === productId);
    if (!product) return;

    const existingItem = cart.find((item) => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
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
}

async function loadMenu() {
    if (!menuGrid) return;

    showStatus("Đang tải thực đơn...");
    menuGrid.replaceChildren();

    const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, is_available, categories(name)")
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

        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
            showStatus("Bạn cần đăng nhập trước khi đặt hàng. Hãy đăng nhập rồi quay lại thực đơn.", true);
            window.location.href = "./login.html?redirect=menu";
            return;
        }

        const user = data.user;
        const fullNameInput = checkoutForm.querySelector('[name="fullName"]');
        if (!fullNameInput.value.trim()) {
            fullNameInput.value = user.user_metadata?.full_name || "";
        }

        checkoutForm.hidden = false;
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
        const items = cart.map((item) => ({
            id: item.id,
            quantity: item.quantity
        }));

        submitOrderButton.disabled = true;
        showCheckoutMessage("Đang gửi đơn hàng lên hệ thống...");

        try {
            const { data, error } = await supabase.rpc("oncafe_create_order", {
                p_full_name: String(formData.get("fullName") || "").trim(),
                p_phone: String(formData.get("phone") || "").trim(),
                p_address: String(formData.get("address") || "").trim(),
                p_payment_method: String(formData.get("paymentMethod") || "cash"),
                p_items: items
            });

            if (error) throw error;

            const order = Array.isArray(data) ? data[0] : data;
            if (!order?.order_code) {
                throw new Error("Hệ thống chưa trả về mã đơn hàng. Vui lòng kiểm tra mục đơn hàng trước khi đặt lại.");
            }

            cart = [];
            saveCart();
            checkoutForm.reset();
            checkoutForm.hidden = true;
            showCheckoutMessage("");
            showStatus(`Đặt hàng thành công! Mã đơn: ${order.order_code}. Tổng tiền: ${currencyFormatter.format(Number(order.total_amount) || 0)}. Đơn đang chờ xác nhận.`);
        } catch (error) {
            console.error("Lỗi đặt hàng ONCafe:", error);
            showCheckoutMessage(error.message || "Không thể tạo đơn hàng. Vui lòng thử lại.", true);
        } finally {
            submitOrderButton.disabled = false;
        }
    });
}

loadMenu();
