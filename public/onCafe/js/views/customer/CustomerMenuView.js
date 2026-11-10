/**
 * CustomerMenuView
 * Chịu trách nhiệm hiển thị danh sách đồ uống và giỏ hàng.
 * Không truy cập repository, service hoặc Supabase.
 */
import { createPaginationMarkup } from "../../utils/PaginationUtils.js";

const MENU_PAGE_SIZE = 12;

export class CustomerMenuView {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor({
        menuGrid,
        menuPagination,
        menuStatus,
        cartItems,
        cartTotal,
        cartCount,
        currencyFormatter,
        onAddToCart,
        onChangeQuantity,
        onRemoveFromCart
    }) {
        this.menuGrid = menuGrid;
        this.menuPagination = menuPagination;
        this.products = [];
        this.currentPage = 1;
        this.menuPagination?.addEventListener("click", (event) => {
            const button = event.target.closest("[data-menu-page]");
            if (!button) return;
            this.currentPage = Number(button.dataset.menuPage) || 1;
            this.renderMenuPage();
            this.menuGrid?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        this.menuStatus = menuStatus;
        this.cartItems = cartItems;
        this.cartTotal = cartTotal;
        this.cartCount = cartCount;
        this.currencyFormatter = currencyFormatter;
        this.onAddToCart = onAddToCart;
        this.onChangeQuantity = onChangeQuantity;
        this.onRemoveFromCart = onRemoveFromCart;
    }

    // Cập nhật thông báo trạng thái trên giao diện.
    showStatus(message, isError = false) {
        if (!this.menuStatus) return;

        this.menuStatus.textContent = message;
        this.menuStatus.classList.toggle("menu-status-error", isError);
        this.menuStatus.hidden = false;
    }

    // Ẩn thông báo trạng thái khỏi giao diện.
    hideStatus() {
        if (this.menuStatus) this.menuStatus.hidden = true;
    }

    // Xóa các món đang hiển thị trên thực đơn.
    clearMenu() {
        this.menuGrid?.replaceChildren();
        if (this.menuPagination) this.menuPagination.replaceChildren();
    }

    // Hiển thị danh sách món trên thực đơn.
    renderMenu(products) {
        if (!this.menuGrid) return;
        this.products = products;
        this.currentPage = Math.min(this.currentPage, Math.max(1, Math.ceil(products.length / MENU_PAGE_SIZE)));
        this.renderMenuPage();
    }

    // Chỉ hiển thị một trang món và cập nhật điều hướng phân trang.
    renderMenuPage() {
        const startIndex = (this.currentPage - 1) * MENU_PAGE_SIZE;
        const pageProducts = this.products.slice(startIndex, startIndex + MENU_PAGE_SIZE);
        this.menuGrid.replaceChildren(...pageProducts.map((product) => this.createMenuCard(product)));
        if (!this.menuPagination) return;
        const totalPages = Math.max(1, Math.ceil(this.products.length / MENU_PAGE_SIZE));
        this.menuPagination.innerHTML = totalPages > 1 ? createPaginationMarkup({
            currentPage: this.currentPage,
            totalPages,
            firstItem: startIndex + 1,
            lastItem: startIndex + pageProducts.length,
            totalItems: this.products.length,
            itemLabel: "món",
            pageKey: "menu"
        }) : "";
    }

    // Tạo thẻ hiển thị một món trên thực đơn.
    createMenuCard(product) {
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
        price.textContent = this.currencyFormatter.format(Number(product.price) || 0);

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "menu-add-button";
        addButton.textContent = Number(product.quantity) > 0 ? "Thêm vào giỏ" : "Tạm hết hàng";
        addButton.disabled = Number(product.quantity) <= 0;
        addButton.addEventListener("click", () => this.onAddToCart(product.id));

        content.append(category, name, price, addButton);
        card.append(imageFrame, content);
        return card;
    }

    // Cập nhật các món và tổng tiền trong giỏ hàng.
    renderCart(items, totalQuantity, totalPrice) {
        if (!this.cartItems || !this.cartTotal || !this.cartCount) return;

        this.cartItems.replaceChildren();
        this.cartCount.textContent = String(totalQuantity);
        this.cartTotal.textContent = this.currencyFormatter.format(totalPrice);

        if (items.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "cart-empty";
            emptyMessage.textContent = "Giỏ hàng đang trống. Hãy chọn đồ uống bạn thích.";
            this.cartItems.append(emptyMessage);
            return;
        }

        items.forEach((item) => {
            const row = document.createElement("div");
            row.className = "cart-item";

            const details = document.createElement("div");
            details.className = "cart-item-details";

            const name = document.createElement("strong");
            name.textContent = item.name;

            const price = document.createElement("span");
            price.textContent = this.currencyFormatter.format(item.price * item.quantity);
            details.append(name, price);

            const controls = document.createElement("div");
            controls.className = "cart-item-controls";

            const decreaseButton = document.createElement("button");
            decreaseButton.type = "button";
            decreaseButton.className = "cart-quantity-button";
            decreaseButton.textContent = "−";
            decreaseButton.setAttribute("aria-label", `Giảm số lượng ${item.name}`);
            decreaseButton.addEventListener("click", () => this.onChangeQuantity(item.id, -1));

            const quantity = document.createElement("span");
            quantity.className = "cart-quantity";
            quantity.textContent = String(item.quantity);

            const increaseButton = document.createElement("button");
            increaseButton.type = "button";
            increaseButton.className = "cart-quantity-button";
            increaseButton.textContent = "+";
            increaseButton.setAttribute("aria-label", `Tăng số lượng ${item.name}`);
            increaseButton.addEventListener("click", () => this.onChangeQuantity(item.id, 1));

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "cart-remove-button";
            removeButton.textContent = "Bỏ";
            removeButton.addEventListener("click", () => this.onRemoveFromCart(item.id));

            controls.append(decreaseButton, quantity, increaseButton, removeButton);
            row.append(details, controls);
            this.cartItems.append(row);
        });
    }
}
