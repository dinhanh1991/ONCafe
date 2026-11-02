import { formatCurrency } from "../../utils/FormatUtils.js";
import { ProductValidator } from "../../validators/ProductValidator.js";
import { ValidationUI } from "../../validators/ValidationUI.js";

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
        this.categoryFilter = "all";
        this.statusFilter = "all";
        this.sortBy = "name-asc";
        this.currentPage = 1;
        this.pageSize = 5;
        this.editingId = null;
        this.detailId = null;

        this.container.addEventListener("input", (event) => {
            if (event.target.matches("[data-product-search]")) {
                this.searchTerm = event.target.value;
                this.currentPage = 1;
                this.renderList();
            }
        });
        this.container.addEventListener("change", (event) => {
            if (event.target.matches("[data-product-category-filter]")) {
                this.categoryFilter = event.target.value;
            } else if (event.target.matches("[data-product-status-filter]")) {
                this.statusFilter = event.target.value;
            } else if (event.target.matches("[data-product-sort]")) {
                this.sortBy = event.target.value;
            } else {
                return;
            }
            this.currentPage = 1;
            this.renderList();
        });
        this.container.addEventListener("click", (event) => this.handleClick(event));
        this.container.addEventListener("focusin", (event) => {
            const form = event.target.closest("[data-product-form]");
            if (form) ValidationUI.bind(form);
        });
        this.container.addEventListener("submit", (event) => this.handleSubmit(event));
    }

    render(products) {
        this.products = Array.isArray(products) ? products : [];
        this.container.innerHTML = `
            <section class="product-manager" aria-labelledby="product-heading">
                <div data-product-list-view>
                    <header class="product-heading">
                        <div>
                            <p class="eyebrow">DANH MỤC</p>
                            <h2 id="product-heading">Quản lý đồ uống</h2>
                            <p data-product-count></p>
                        </div>
                        <button class="button button-primary" type="button" data-action="new"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Thêm đồ uống</button>
                    </header>
                    <div class="product-toolbar">
                        <label class="visually-hidden" for="product-search">Tìm sản phẩm</label>
                        <input id="product-search" data-product-search type="search" placeholder="Tìm theo tên hoặc danh mục" value="${escapeHtml(this.searchTerm)}">
                        <label class="visually-hidden" for="product-category-filter">Lọc theo danh mục</label>
                        <select id="product-category-filter" data-product-category-filter aria-label="Lọc theo danh mục">
                            <option value="all">Tất cả danh mục</option>
                        </select>
                        <label class="visually-hidden" for="product-status-filter">Lọc theo trạng thái</label>
                        <select id="product-status-filter" data-product-status-filter aria-label="Lọc theo trạng thái">
                            <option value="all">Tất cả trạng thái</option>
                            <option value="active">Đang bán</option>
                            <option value="inactive">Ngừng bán</option>
                        </select>
                        <label class="visually-hidden" for="product-sort">Sắp xếp đồ uống</label>
                        <select id="product-sort" data-product-sort aria-label="Sắp xếp đồ uống">
                            <option value="name-asc">Tên A–Z</option>
                            <option value="name-desc">Tên Z–A</option>
                            <option value="price-asc">Giá thấp đến cao</option>
                            <option value="price-desc">Giá cao đến thấp</option>
                            <option value="quantity-asc">Tồn kho thấp đến cao</option>
                            <option value="quantity-desc">Tồn kho cao đến thấp</option>
                        </select>
                    </div>
                    <div class="table-scroll">
                        <table class="product-table">
                            <thead><tr><th>Ảnh</th><th>Tên sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                            <tbody data-product-list></tbody>
                        </table>
                    </div>
                    <nav class="product-pagination" data-product-pagination aria-label="Phân trang đồ uống"></nav>
                </div>
                <section class="product-detail-view" data-product-detail-view hidden aria-labelledby="product-detail-heading"></section>
                <section class="product-form-view" data-product-form-view hidden aria-labelledby="product-form-heading">
                    <header class="product-heading">
                        <div>
                            <p class="eyebrow">DANH MỤC ĐỒ UỐNG</p>
                            <h2 id="product-form-heading" data-form-heading>Thêm đồ uống</h2>
                            <p data-form-description>Nhập thông tin đồ uống mới.</p>
                        </div>
                        <button class="button" type="button" data-action="cancel"><i class="bi bi-arrow-left me-1" aria-hidden="true"></i>Danh sách đồ uống</button>
                    </header>
                    <form class="product-form" data-product-form novalidate>
                        <div class="product-form-grid">
                            <label>Tên đồ uống<input name="name" required maxlength="120"></label>
                            <label>Danh mục<input name="category" required maxlength="80"></label>
                            <label>Giá bán (VNĐ)<input name="price" type="number" min="0" step="1" required></label>
                            <label>Số lượng<input name="quantity" type="number" min="0" step="1" required></label>
                            <label class="product-description">Ảnh đồ uống
                                <input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                                <small class="image-help">Chọn ảnh JPG, PNG, WEBP hoặc GIF, tối đa 5 MB. Ảnh sẽ được lưu trên Supabase Storage.</small>
                            </label>
                        </div>
                        <p class="form-error" data-form-error role="alert"></p>
                        <div class="form-actions">
                            <button class="button button-primary" type="submit">Lưu đồ uống</button>
                            <button class="button button-secondary" type="button" data-action="cancel">Hủy</button>
                        </div>
                    </form>
                </section>
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
        const categoryFilter = this.container.querySelector("[data-product-category-filter]");
        const categories = [...new Set(this.products.map((product) => String(product.category || "").trim()).filter(Boolean))]
            .sort((first, second) => first.localeCompare(second, "vi"));
        categoryFilter.insertAdjacentHTML("beforeend", categories.map((category) =>
            `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
        ).join(""));
        categoryFilter.value = categories.includes(this.categoryFilter) ? this.categoryFilter : "all";
        this.categoryFilter = categoryFilter.value;
        this.container.querySelector("[data-product-status-filter]").value = this.statusFilter;
        this.container.querySelector("[data-product-sort]").value = this.sortBy;
        ValidationUI.bind(this.container.querySelector("[data-product-form]"));
        this.renderList();
        return this;
    }

    getFilteredProducts() {
        const term = this.searchTerm.trim().toLocaleLowerCase("vi");
        const products = this.products.filter((product) =>
            `${product.name ?? ""} ${product.category ?? ""}`.toLocaleLowerCase("vi").includes(term) &&
            (this.categoryFilter === "all" || String(product.category || "").trim() === this.categoryFilter) &&
            (this.statusFilter === "all" || (product.status || "active") === this.statusFilter)
        );
        const [field, direction] = this.sortBy.split("-");
        products.sort((first, second) => {
            const comparison = field === "name"
                ? String(first.name || "").localeCompare(String(second.name || ""), "vi")
                : Number(first[field]) - Number(second[field]);
            return direction === "desc" ? -comparison : comparison;
        });
        return products;
    }

    renderList() {
        const list = this.container.querySelector("[data-product-list]");
        if (!list) return;

        const products = this.getFilteredProducts();

        this.container.querySelector("[data-product-count]").textContent = `${products.length} sản phẩm`;
        const pagination = this.container.querySelector("[data-product-pagination]");
        const totalPages = Math.max(1, Math.ceil(products.length / this.pageSize));
        this.currentPage = Math.min(this.currentPage, totalPages);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const pageProducts = products.slice(startIndex, startIndex + this.pageSize);

        if (products.length === 0) {
            list.innerHTML = '<tr><td class="empty-state" colspan="7">Không tìm thấy sản phẩm.</td></tr>';
            pagination.innerHTML = "";
            return;
        }

        pagination.innerHTML = `<span>Trang ${this.currentPage} / ${totalPages} · ${products.length} sản phẩm</span>
            <div class="pagination-actions">
                <button class="button button-small" type="button" data-product-page="${this.currentPage - 1}" ${this.currentPage === 1 ? "disabled" : ""}>Trước</button>
                <button class="button button-small" type="button" data-product-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? "disabled" : ""}>Sau</button>
            </div>`;

        list.innerHTML = pageProducts.map((product) => `
            <tr>
                <td><img class="product-thumb" src="${escapeHtml(product.imageUrl || "./assets/images/bac-xiu.jpg")}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.hidden=true"></td>
                <td class="product-name">${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.category)}</td>
                <td>${formatCurrency(product.price)}</td>
                <td>${escapeHtml(product.quantity)}</td>
                <td><span class="status ${product.status === "active" ? "status-active" : "status-inactive"}">${product.status === "active" ? "Đang bán" : "Ngừng bán"}</span></td>
                <td class="row-actions">
                    <button class="button button-small" type="button" data-action="detail" data-id="${escapeHtml(product.id)}"><i class="bi bi-eye me-1" aria-hidden="true"></i>Chi tiết</button>
                    <button class="button button-small" type="button" data-action="edit" data-id="${escapeHtml(product.id)}"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Sửa</button>
                    <button class="button button-small button-danger" type="button" data-action="delete" data-id="${escapeHtml(product.id)}"><i class="bi bi-trash me-1" aria-hidden="true"></i>Xóa</button>
                </td>
            </tr>`).join("");
    }

    handleClick(event) {
        const button = event.target.closest("button[data-action], button[data-dialog-action], button[data-product-page]");
        if (!button || !this.container.contains(button)) return;

        if (button.hasAttribute("data-product-page")) {
            const requestedPage = Number.parseInt(button.dataset.productPage, 10);
            const products = this.getFilteredProducts();
            const totalPages = Math.max(1, Math.ceil(products.length / this.pageSize));
            if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages) {
                this.currentPage = requestedPage;
                this.renderList();
            }
            return;
        }

        if (button.dataset.dialogAction) {
            this.handleDialogAction(button.dataset.dialogAction);
            return;
        }

        if (button.dataset.action === "new") {
            this.openForm();
        } else if (button.dataset.action === "cancel") {
            this.closeForm();
        } else if (button.dataset.action === "back-to-list") {
            this.showList();
        } else if (button.dataset.action === "detail") {
            this.openDetail(button.dataset.id);
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

        this.detailId = null;
        this.editingId = product?.id ?? null;
        form.reset();
        this.container.querySelector("[data-product-list-view]").hidden = true;
        this.container.querySelector("[data-product-form-view]").hidden = false;
        this.container.querySelector("[data-form-heading]").textContent = product ? "Cập nhật đồ uống" : "Thêm đồ uống";
        this.container.querySelector("[data-form-description]").textContent = product
            ? "Cập nhật thông tin và số lượng tồn kho."
            : "Nhập thông tin đồ uống mới để thêm vào danh sách.";
        form.querySelector('button[type="submit"]').textContent = product ? "Lưu thay đổi" : "Thêm đồ uống";
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
        form.reset();
        this.editingId = null;
        this.showList();
    }

    showList() {
        this.detailId = null;
        this.container.querySelector("[data-product-form-view]").hidden = true;
        this.container.querySelector("[data-product-detail-view]").hidden = true;
        this.container.querySelector("[data-product-list-view]").hidden = false;
    }

    openDetail(id) {
        const product = this.products.find((item) => String(item.id) === String(id));
        if (!product) return;

        this.detailId = product.id;
        const detailView = this.container.querySelector("[data-product-detail-view]");
        const status = product.status === "active" ? "Đang bán" : "Ngừng bán";
        const statusClass = product.status === "active" ? "status-active" : "status-inactive";
        detailView.innerHTML = `
            <header class="product-heading">
                <div>
                    <p class="eyebrow">CHI TIẾT ĐỒ UỐNG</p>
                    <h2 id="product-detail-heading">${escapeHtml(product.name)}</h2>
                    <p>Thông tin sản phẩm trong danh mục ONCafe.</p>
                </div>
                <button class="button" type="button" data-action="back-to-list">← Danh sách đồ uống</button>
            </header>
            <div class="product-detail-card">
                <img class="product-detail-image" src="${escapeHtml(product.imageUrl || "./assets/images/bac-xiu.jpg")}" alt="${escapeHtml(product.name)}" onerror="this.hidden=true">
                <dl class="product-detail-fields">
                    <div><dt>Tên đồ uống</dt><dd>${escapeHtml(product.name)}</dd></div>
                    <div><dt>Danh mục</dt><dd>${escapeHtml(product.category || "Chưa phân loại")}</dd></div>
                    <div><dt>Giá bán</dt><dd>${formatCurrency(product.price)}</dd></div>
                    <div><dt>Số lượng tồn kho</dt><dd>${escapeHtml(product.quantity)}</dd></div>
                    <div><dt>Trạng thái</dt><dd><span class="status ${statusClass}">${status}</span></dd></div>
                </dl>
            </div>
            <div class="product-detail-actions">
                <button class="button button-primary" type="button" data-action="edit" data-id="${escapeHtml(product.id)}">Sửa đồ uống</button>
                <button class="button button-danger" type="button" data-action="delete" data-id="${escapeHtml(product.id)}">Xóa đồ uống</button>
            </div>`;
        this.container.querySelector("[data-product-list-view]").hidden = true;
        this.container.querySelector("[data-product-form-view]").hidden = true;
        detailView.hidden = false;
        this.container.querySelector("[data-product-form-view]").hidden = true;
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
        const validation = ProductValidator.validate(product);
        ValidationUI.bind(form);
        if (!validation.isValid) {
            ValidationUI.showErrors(form, validation.errors);
            return;
        }
        ValidationUI.clearErrors(form);
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
                    if (wasEditing) this.openDetail(savedProduct.id);
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
                    if (error.validationErrors) {
                        ValidationUI.showErrors(form, error.validationErrors);
                        form.querySelector("[data-form-error]").textContent = "";
                    } else {
                        form.querySelector("[data-form-error]").textContent = error.message || "Không thể lưu sản phẩm.";
                    }
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
                    this.showList();
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
