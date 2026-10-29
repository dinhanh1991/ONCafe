import { formatCurrency } from "../utils/FormatUtils.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
}[character]));

export class ProductView {
    constructor(container, { onSave, onDelete }) {
        if (!container) throw new Error("Không tìm thấy vùng hiển thị sản phẩm.");

        this.container = container;
        this.onSave = onSave;
        this.onDelete = onDelete;
        this.products = [];
        this.searchTerm = "";
        this.editingId = null;

        this.container.addEventListener("input", (event) => {
            if (event.target.matches("[data-product-search]")) {
                this.searchTerm = event.target.value;
                this.renderList();
            }
        });
        this.container.addEventListener("click", (event) => this.handleClick(event));
        this.container.addEventListener("submit", (event) => this.handleSubmit(event));
    }

    render(products) {
        this.products = Array.isArray(products) ? products : [];
        this.container.innerHTML = `
            <section class="product-manager" aria-labelledby="product-heading">
                <header class="product-heading">
                    <div>
                        <p class="eyebrow">QUẢN LÝ KHO</p>
                        <h2 id="product-heading">Sản phẩm</h2>
                        <p data-product-count></p>
                    </div>
                    <button class="button button-primary" type="button" data-action="new">+ Thêm sản phẩm</button>
                </header>
                <div class="product-toolbar">
                    <label class="visually-hidden" for="product-search">Tìm sản phẩm</label>
                    <input id="product-search" data-product-search type="search" placeholder="Tìm theo tên hoặc danh mục" value="${escapeHtml(this.searchTerm)}">
                </div>
                <form class="product-form" data-product-form hidden>
                    <h3 data-form-heading>Thêm sản phẩm</h3>
                    <div class="product-form-grid">
                        <label>Tên sản phẩm<input name="name" required maxlength="120"></label>
                        <label>Danh mục<input name="category" required maxlength="80"></label>
                        <label>Giá bán (VNĐ)<input name="price" type="number" min="0" step="1" required></label>
                        <label>Số lượng<input name="quantity" type="number" min="0" step="1" required></label>
                        <label class="product-description">Ảnh sản phẩm
                            <input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                            <small class="image-help">Chọn ảnh JPG, PNG, WEBP hoặc GIF, tối đa 5 MB. Ảnh sẽ được lưu trên Supabase Storage.</small>
                        </label>
                    </div>
                    <p class="form-error" data-form-error role="alert"></p>
                    <div class="form-actions">
                        <button class="button button-primary" type="submit">Lưu sản phẩm</button>
                        <button class="button button-secondary" type="button" data-action="cancel">Hủy</button>
                    </div>
                </form>
                <div class="table-scroll">
                    <table class="product-table">
                        <thead><tr><th>Ảnh</th><th>Tên sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                        <tbody data-product-list></tbody>
                    </table>
                </div>
                <div class="app-dialog-backdrop" data-dialog hidden>
                    <section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
                        <div class="dialog-icon" data-dialog-icon aria-hidden="true">!</div>
                        <h3 id="dialog-title" data-dialog-title>Xác nhận thao tác</h3>
                        <p id="dialog-message" data-dialog-message></p>
                        <div class="dialog-actions" data-dialog-actions>
                            <button class="button button-secondary" type="button" data-dialog-action="cancel">Hủy</button>
                            <button class="button button-danger" type="button" data-dialog-action="confirm">Xác nhận</button>
                        </div>
                    </section>
                </div>
            </section>`;
        this.renderList();
        return this;
    }

    renderList() {
        const list = this.container.querySelector("[data-product-list]");
        if (!list) return;

        const term = this.searchTerm.trim().toLocaleLowerCase("vi");
        const products = this.products.filter((product) =>
            `${product.name ?? ""} ${product.category ?? ""}`.toLocaleLowerCase("vi").includes(term)
        );

        this.container.querySelector("[data-product-count]").textContent = `${products.length} sản phẩm`;
        if (products.length === 0) {
            list.innerHTML = '<tr><td class="empty-state" colspan="7">Không tìm thấy sản phẩm.</td></tr>';
            return;
        }

        list.innerHTML = products.map((product) => `
            <tr>
                <td><img class="product-thumb" src="${escapeHtml(product.imageUrl || "./assets/images/product-placeholder.jpg")}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.hidden=true"></td>
                <td class="product-name">${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.category)}</td>
                <td>${formatCurrency(product.price)}</td>
                <td>${escapeHtml(product.quantity)}</td>
                <td><span class="status ${product.status === "active" ? "status-active" : "status-inactive"}">${product.status === "active" ? "Đang bán" : "Ngừng bán"}</span></td>
                <td class="row-actions">
                    <button class="button button-small" type="button" data-action="edit" data-id="${escapeHtml(product.id)}">Sửa</button>
                    <button class="button button-small button-danger" type="button" data-action="delete" data-id="${escapeHtml(product.id)}">Xóa</button>
                </td>
            </tr>`).join("");
    }

    handleClick(event) {
        const button = event.target.closest("button[data-action], button[data-dialog-action]");
        if (!button || !this.container.contains(button)) return;

        if (button.dataset.dialogAction) {
            this.handleDialogAction(button.dataset.dialogAction);
            return;
        }

        if (button.dataset.action === "new") {
            this.openForm();
        } else if (button.dataset.action === "cancel") {
            this.closeForm();
        } else if (button.dataset.action === "edit") {
            this.openForm(button.dataset.id);
        } else if (button.dataset.action === "delete") {
            this.confirmDeleteProduct(button.dataset.id);
        }
    }

    openForm(id = null) {
        const form = this.container.querySelector("[data-product-form]");
        const product = id === null ? null : this.products.find((item) => String(item.id) === String(id));
        if (id !== null && !product) return;

        this.editingId = product?.id ?? null;
        form.reset();
        form.hidden = false;
        form.querySelector("[data-form-heading]").textContent = product ? "Cập nhật sản phẩm" : "Thêm sản phẩm";
        form.querySelector('[name="name"]').value = product?.name ?? "";
        form.querySelector('[name="category"]').value = product?.category ?? "";
        form.querySelector('[name="price"]').value = product?.price ?? "";
        form.querySelector('[name="quantity"]').value = product?.quantity ?? "0";
        form.querySelector('[name="imageFile"]').value = "";
        form.querySelector("[data-form-error]").textContent = "";
        form.querySelector('[name="name"]').focus();
    }

    closeForm() {
        const form = this.container.querySelector("[data-product-form]");
        form.hidden = true;
        form.reset();
        this.editingId = null;
    }

    async handleSubmit(event) {
        if (!event.target.matches("[data-product-form]")) return;
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);
        const product = Object.fromEntries(formData.entries());
        product.price = Number(product.price);
        product.quantity = Number(product.quantity);
        product.imageFile = form.querySelector('[name="imageFile"]').files[0] ?? null;
        product.status = this.products.find((item) => String(item.id) === String(this.editingId))?.status ?? "active";
        const wasEditing = this.editingId !== null;
        if (wasEditing) product.id = this.editingId;

        this.showDialog({
            type: "info",
            title: wasEditing ? "Xác nhận cập nhật" : "Xác nhận thêm sản phẩm",
            message: wasEditing
                ? `Bạn có chắc chắn muốn lưu thay đổi cho sản phẩm “${product.name}” không?`
                : `Bạn có chắc chắn muốn thêm sản phẩm “${product.name}” không?`,
            confirmText: wasEditing ? "Xác nhận sửa" : "Xác nhận thêm",
            onConfirm: async () => {
                try {
                    const savedProduct = await this.onSave(product);
                    const index = this.products.findIndex((item) => String(item.id) === String(savedProduct.id));
                    if (index === -1) this.products = [...this.products, savedProduct];
                    else this.products = this.products.map((item, itemIndex) => itemIndex === index ? savedProduct : item);
                    this.closeForm();
                    this.renderList();
                    this.showDialog({
                        type: "success",
                        title: wasEditing ? "Cập nhật thành công" : "Thêm sản phẩm thành công",
                        message: wasEditing
                            ? `Sản phẩm “${savedProduct.name}” đã được cập nhật.`
                            : `Sản phẩm “${savedProduct.name}” đã được thêm vào danh sách.`,
                        confirmText: "Đóng",
                        hideCancel: true
                    });
                } catch (error) {
                    form.querySelector("[data-form-error]").textContent = error.message || "Không thể lưu sản phẩm.";
                }
            }
        });
    }

    confirmDeleteProduct(id) {
        const product = this.products.find((item) => String(item.id) === String(id));
        if (!product) return;

        this.showDialog({
            type: "danger",
            title: "Xác nhận xóa sản phẩm",
            message: `Bạn có chắc chắn muốn xóa “${product.name}” không? Thao tác này không thể hoàn tác.`,
            confirmText: "Xác nhận xóa",
            onConfirm: async () => {
                try {
                    await this.onDelete(id);
                    this.products = this.products.filter((item) => String(item.id) !== String(id));
                    this.renderList();
                    this.showDialog({
                        type: "success",
                        title: "Xóa thành công",
                        message: `Sản phẩm “${product.name}” đã được xóa.`,
                        confirmText: "Đóng",
                        hideCancel: true
                    });
                } catch (error) {
                    this.showDialog({
                        type: "error",
                        title: "Không thể xóa sản phẩm",
                        message: error.message || "Đã xảy ra lỗi khi xóa sản phẩm.",
                        confirmText: "Đóng",
                        hideCancel: true
                    });
                }
            }
        });
    }

    showDialog({ type = "info", title, message, confirmText = "Đóng", hideCancel = false, onConfirm = null }) {
        const dialog = this.container.querySelector("[data-dialog]");
        const actions = dialog.querySelector("[data-dialog-actions]");
        dialog.dataset.type = type;
        dialog.querySelector("[data-dialog-title]").textContent = title;
        dialog.querySelector("[data-dialog-message]").textContent = message;
        dialog.querySelector("[data-dialog-icon]").textContent =
            type === "success" ? "✓" : type === "danger" ? "!" : type === "error" ? "×" : "?";
        actions.querySelector('[data-dialog-action="confirm"]').textContent = confirmText;
        actions.querySelector('[data-dialog-action="cancel"]').hidden = hideCancel;
        this.pendingDialogAction = onConfirm;
        dialog.hidden = false;
        actions.querySelector('[data-dialog-action="confirm"]').focus();
    }

    async handleDialogAction(action) {
        const dialog = this.container.querySelector("[data-dialog]");
        if (action === "cancel") {
            this.pendingDialogAction = null;
            dialog.hidden = true;
            return;
        }

        const callback = this.pendingDialogAction;
        this.pendingDialogAction = null;
        dialog.hidden = true;
        if (callback) await callback();
    }
}
