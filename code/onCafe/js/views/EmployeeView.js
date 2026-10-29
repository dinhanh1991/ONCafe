const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
}[character]));

export class EmployeeView {
    constructor(container, { onLoad, onCreate, onUpdate, onDelete }) {
        if (!container) throw new Error("Không tìm thấy vùng hiển thị nhân viên.");

        this.container = container;
        this.onLoad = onLoad;
        this.onCreate = onCreate;
        this.onUpdate = onUpdate;
        this.onDelete = onDelete;
        this.employees = [];
        this.searchTerm = "";
        this.currentPage = 1;
        this.pageSize = 5;
        this.busy = false;
        this.editingId = null;

        this.container.addEventListener("input", (event) => {
            if (event.target.matches("[data-employee-search]")) {
                this.searchTerm = event.target.value;
                this.currentPage = 1;
                this.renderList();
            }
        });
        this.container.addEventListener("click", (event) => this.handleClick(event));
        this.container.addEventListener("submit", (event) => this.handleSubmit(event));
    }

    render() {
        this.container.innerHTML = `
            <section class="employee-manager" aria-labelledby="employee-heading">
                <div data-employee-list-view>
                    <header class="product-heading">
                        <div>
                            <p class="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
                            <h2 id="employee-heading">Quản lý nhân viên</h2>
                            <p data-employee-count></p>
                        </div>
                        <button class="button button-primary" type="button" data-employee-action="new">+ Thêm nhân viên</button>
                    </header>
                    <div class="product-toolbar">
                        <label class="visually-hidden" for="employee-search">Tìm nhân viên</label>
                        <input id="employee-search" data-employee-search type="search" placeholder="Tìm theo họ tên hoặc email">
                    </div>
                    <p class="employee-feedback" data-employee-feedback role="status" aria-live="polite"></p>
                    <div class="table-scroll">
                        <table class="product-table employee-table">
                            <thead><tr><th>Họ và tên</th><th>Email đăng nhập</th><th>Vai trò</th><th>Thao tác</th></tr></thead>
                            <tbody data-employee-list></tbody>
                        </table>
                    </div>
                    <nav class="employee-pagination product-pagination" data-employee-pagination aria-label="Phân trang nhân viên"></nav>
                </div>
                <section class="employee-form-view" data-employee-form-view hidden aria-labelledby="employee-form-heading">
                    <header class="product-heading">
                        <div>
                            <p class="eyebrow">QUẢN TRỊ HỆ THỐNG</p>
                            <h2 id="employee-form-heading" data-employee-form-heading>Thêm nhân viên</h2>
                            <p data-employee-form-description>Tạo tài khoản thu ngân mới.</p>
                        </div>
                        <button class="button" type="button" data-employee-action="back">← Danh sách</button>
                    </header>
                    <form class="product-form" data-employee-form>
                        <div class="product-form-grid">
                            <label>Họ và tên
                                <input name="fullName" type="text" minlength="2" maxlength="100" autocomplete="name" required>
                            </label>
                            <label>Email nhân viên
                                <input name="email" type="email" maxlength="254" autocomplete="email" required>
                            </label>
                            <label>Vai trò
                                <select name="role" required>
                                    <option value="cashier">Thu ngân (Cashier)</option>
                                    <option value="seller">Người bán hàng (Seller)</option>
                                    <option value="admin">Quản trị viên (Admin)</option>
                                </select>
                            </label>
                            <label data-employee-password-label>Mật khẩu ban đầu
                                <input name="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" required>
                                <small data-employee-password-help>Dùng ít nhất 8 ký tự; cung cấp cho nhân viên qua kênh riêng.</small>
                            </label>
                        </div>
                        <p class="form-error" data-employee-form-error role="alert"></p>
                        <div class="form-actions">
                            <button class="button button-primary" type="submit">Tạo tài khoản</button>
                            <button class="button button-secondary" type="button" data-employee-action="back">Hủy</button>
                        </div>
                    </form>
                </section>
                <div class="app-dialog-backdrop" data-employee-dialog hidden>
                    <section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="employee-dialog-title" aria-describedby="employee-dialog-message">
                        <div class="dialog-icon" data-employee-dialog-icon aria-hidden="true">?</div>
                        <h3 id="employee-dialog-title" data-employee-dialog-title>Xác nhận thao tác</h3>
                        <p id="employee-dialog-message" data-employee-dialog-message></p>
                        <div class="dialog-actions" data-employee-dialog-actions>
                            <button class="button button-secondary" type="button" data-employee-dialog-action="cancel">Hủy</button>
                            <button class="button button-primary" type="button" data-employee-dialog-action="confirm">Xác nhận</button>
                        </div>
                    </section>
                </div>
            </section>`;

        this.renderList();
        return this;
    }

    async load() {
        this.setFeedback("Đang tải danh sách nhân viên...");
        try {
            this.employees = await this.onLoad();
            this.setFeedback("");
            this.renderList();
        } catch (error) {
            console.error("Không thể tải danh sách nhân viên:", error);
            this.setFeedback(error.message || "Không thể tải danh sách nhân viên.", true);
        }
    }

    renderList() {
        const list = this.container.querySelector("[data-employee-list]");
        if (!list) return;

        const term = this.searchTerm.trim().toLocaleLowerCase("vi");
        const employees = this.employees.filter((employee) =>
            `${employee.full_name ?? ""} ${employee.email ?? ""}`.toLocaleLowerCase("vi").includes(term)
        );
        this.container.querySelector("[data-employee-count]").textContent =
            `${employees.length} nhân viên`;
        const pagination = this.container.querySelector("[data-employee-pagination]");
        const totalPages = Math.max(1, Math.ceil(employees.length / this.pageSize));
        this.currentPage = Math.min(this.currentPage, totalPages);
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const pageEmployees = employees.slice(startIndex, startIndex + this.pageSize);

        if (!employees.length) {
            list.innerHTML = '<tr><td class="empty-state" colspan="4">Chưa có nhân viên phù hợp.</td></tr>';
            pagination.innerHTML = "";
            return;
        }

        pagination.innerHTML = `<span>Trang ${this.currentPage} / ${totalPages} · ${employees.length} nhân viên</span>
            <div class="pagination-actions">
                <button class="button button-small" type="button" data-employee-page="${this.currentPage - 1}" ${this.currentPage === 1 ? "disabled" : ""}>Trước</button>
                <button class="button button-small" type="button" data-employee-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? "disabled" : ""}>Sau</button>
            </div>`;

        list.innerHTML = pageEmployees.map((employee) => `
            <tr>
                <td class="product-name">${escapeHtml(employee.full_name)}</td>
                <td>${escapeHtml(employee.email)}</td>
                <td><span class="status status-active">${escapeHtml(({ admin: "Quản trị viên", cashier: "Thu ngân", seller: "Người bán hàng" })[employee.role] || employee.role || "Chưa xác định")}</span></td>
                <td class="row-actions">
                    <button class="button button-small" type="button" data-employee-action="edit" data-id="${escapeHtml(employee.id)}" ${this.busy ? "disabled" : ""}>Sửa</button>
                    <button class="button button-small button-danger" type="button" data-employee-action="delete" data-id="${escapeHtml(employee.id)}" ${this.busy ? "disabled" : ""}>Xóa</button>
                </td>
            </tr>`).join("");
    }

    handleClick(event) {
        const dialogButton = event.target.closest("[data-employee-dialog-action]");
        if (dialogButton && this.container.contains(dialogButton)) {
            void this.handleDialogAction(dialogButton.dataset.employeeDialogAction);
            return;
        }

        const pageButton = event.target.closest("button[data-employee-page]");
        if (pageButton && this.container.contains(pageButton)) {
            const requestedPage = Number.parseInt(pageButton.dataset.employeePage, 10);
            const term = this.searchTerm.trim().toLocaleLowerCase("vi");
            const employees = this.employees.filter((employee) =>
                `${employee.full_name ?? ""} ${employee.email ?? ""}`.toLocaleLowerCase("vi").includes(term)
            );
            const totalPages = Math.max(1, Math.ceil(employees.length / this.pageSize));
            if (Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= totalPages) {
                this.currentPage = requestedPage;
                this.renderList();
            }
            return;
        }

        const button = event.target.closest("[data-employee-action]");
        if (!button || !this.container.contains(button) || this.busy) return;

        if (button.dataset.employeeAction === "new") {
            this.openForm();
        } else if (button.dataset.employeeAction === "back") {
            this.closeForm();
        } else if (button.dataset.employeeAction === "edit") {
            this.openForm(button.dataset.id);
        } else if (button.dataset.employeeAction === "delete") {
            void this.deleteEmployee(button.dataset.id);
        }
    }

    openForm(id = null) {
        const employee = id === null
            ? null
            : this.employees.find((item) => String(item.id) === String(id));
        if (id !== null && !employee) return;

        this.editingId = employee?.id ?? null;
        const listView = this.container.querySelector("[data-employee-list-view]");
        const formView = this.container.querySelector("[data-employee-form-view]");
        const form = this.container.querySelector("[data-employee-form]");
        form.reset();
        this.container.querySelector("[data-employee-form-heading]").textContent =
            employee ? "Cập nhật nhân viên" : "Thêm nhân viên";
        this.container.querySelector("[data-employee-form-description]").textContent =
            employee ? "Cập nhật thông tin tài khoản thu ngân." : "Tạo tài khoản thu ngân mới.";
        form.querySelector('[name="fullName"]').value = employee?.full_name ?? "";
        form.querySelector('[name="email"]').value = employee?.email ?? "";
        form.querySelector('[name="email"]').readOnly = Boolean(employee);
        form.querySelector('[name="role"]').value = employee?.role ?? "cashier";

        const passwordInput = form.querySelector('[name="password"]');
        const passwordLabel = form.querySelector("[data-employee-password-label]");
        const submitButton = form.querySelector('button[type="submit"]');
        passwordInput.required = !employee;
        passwordLabel.childNodes[0].textContent = employee ? "Mật khẩu mới (không bắt buộc)" : "Mật khẩu ban đầu";
        form.querySelector("[data-employee-password-help]").textContent = employee
            ? "Để trống nếu không muốn đổi mật khẩu."
            : "Dùng ít nhất 8 ký tự; cung cấp cho nhân viên qua kênh riêng.";
        submitButton.textContent = employee ? "Lưu thay đổi" : "Tạo tài khoản";
        form.querySelector("[data-employee-form-error]").textContent = "";
        listView.hidden = true;
        formView.hidden = false;
        form.querySelector('[name="fullName"]').focus();
    }

    closeForm() {
        this.editingId = null;
        this.container.querySelector("[data-employee-form]").reset();
        this.container.querySelector("[data-employee-form-view]").hidden = true;
        this.container.querySelector("[data-employee-list-view]").hidden = false;
    }

    async handleSubmit(event) {
        if (!event.target.matches("[data-employee-form]")) return;
        event.preventDefault();
        if (this.busy) return;

        const form = event.target;
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const employee = {
            fullName: String(formData.get("fullName") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            password: String(formData.get("password") || ""),
            role: String(formData.get("role") || "cashier")
        };
        const wasEditing = this.editingId !== null;
        if (wasEditing) employee.id = this.editingId;

        this.showDialog({
            type: "info",
            title: wasEditing ? "Xác nhận cập nhật nhân viên" : "Xác nhận tạo nhân viên",
            message: wasEditing
                ? `Bạn có chắc muốn lưu thay đổi cho tài khoản “${employee.fullName}” không?`
                : `Bạn có chắc muốn tạo tài khoản cho “${employee.fullName}” với vai trò đã chọn không?`,
            confirmText: wasEditing ? "Lưu thay đổi" : "Tạo tài khoản",
            onConfirm: () => this.saveEmployee(employee, wasEditing, form)
        });
    }

    async saveEmployee(employee, wasEditing, form) {
        if (this.busy) return;
        this.setBusy(true);
        form.querySelector("[data-employee-form-error]").textContent = "";

        try {
            const saved = wasEditing
                ? await this.onUpdate(employee)
                : await this.onCreate(employee);
            const index = this.employees.findIndex((item) => String(item.id) === String(saved.id));
            this.employees = index === -1
                ? [...this.employees, saved]
                : this.employees.map((item, itemIndex) => itemIndex === index ? saved : item);
            if (index === -1) this.currentPage = Math.max(1, Math.ceil(this.employees.length / this.pageSize));
            this.closeForm();
            this.renderList();
            this.showDialog({
                type: "success",
                title: wasEditing ? "Cập nhật thành công" : "Tạo nhân viên thành công",
                message: wasEditing
                    ? `Thông tin tài khoản “${saved.full_name || employee.fullName}” đã được cập nhật.`
                    : `Tài khoản “${saved.full_name || employee.fullName}” đã được tạo thành công.`,
                confirmText: "Đóng",
                hideCancel: true
            });
        } catch (error) {
            console.error("Không thể lưu thông tin nhân viên:", error);
            form.querySelector("[data-employee-form-error]").textContent =
                error.message || "Không thể lưu thông tin nhân viên.";
            this.showDialog({
                type: "error",
                title: wasEditing ? "Không thể cập nhật nhân viên" : "Không thể tạo nhân viên",
                message: error.message || "Đã xảy ra lỗi khi lưu thông tin nhân viên.",
                confirmText: "Đóng",
                hideCancel: true
            });
        } finally {
            this.setBusy(false);
        }
    }

    async deleteEmployee(id) {
        const employee = this.employees.find((item) => String(item.id) === String(id));
        if (!employee) return;

        this.showDialog({
            type: "danger",
            title: "Xác nhận xóa nhân viên",
            message: `Bạn có chắc muốn xóa tài khoản “${employee.full_name}” (${employee.email})? Tài khoản đăng nhập sẽ bị xóa và không thể khôi phục.`,
            confirmText: "Xóa tài khoản",
            onConfirm: async () => {
                if (this.busy) return;
                this.setBusy(true);
                try {
                    await this.onDelete(id);
                    this.employees = this.employees.filter((item) => String(item.id) !== String(id));
                    this.renderList();
                    this.showDialog({
                        type: "success",
                        title: "Xóa nhân viên thành công",
                        message: `Tài khoản “${employee.full_name}” đã được xóa.`,
                        confirmText: "Đóng",
                        hideCancel: true
                    });
                } catch (error) {
                    console.error("Không thể xóa nhân viên:", error);
                    this.showDialog({
                        type: "error",
                        title: "Không thể xóa nhân viên",
                        message: error.message || "Đã xảy ra lỗi khi xóa tài khoản nhân viên.",
                        confirmText: "Đóng",
                        hideCancel: true
                    });
                } finally {
                    this.setBusy(false);
                }
            }
        });
    }

    showDialog({ type = "info", title, message, confirmText = "Đóng", hideCancel = false, onConfirm = null }) {
        const dialog = this.container.querySelector("[data-employee-dialog]");
        const actions = dialog.querySelector("[data-employee-dialog-actions]");
        dialog.dataset.type = type;
        dialog.querySelector("[data-employee-dialog-title]").textContent = title;
        dialog.querySelector("[data-employee-dialog-message]").textContent = message;
        dialog.querySelector("[data-employee-dialog-icon]").textContent =
            type === "success" ? "✓" : type === "danger" ? "!" : type === "error" ? "×" : "?";
        actions.querySelector('[data-employee-dialog-action="confirm"]').textContent = confirmText;
        actions.querySelector('[data-employee-dialog-action="cancel"]').hidden = hideCancel;
        this.pendingDialogAction = onConfirm;
        dialog.hidden = false;
        actions.querySelector('[data-employee-dialog-action="confirm"]').focus();
    }

    async handleDialogAction(action) {
        const dialog = this.container.querySelector("[data-employee-dialog]");
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

    setBusy(busy) {
        this.busy = busy;
        this.container.querySelectorAll("[data-employee-action], [data-employee-form] button, [data-employee-form] input")
            .forEach((button) => { button.disabled = busy; });
        this.renderList();
    }

    setFeedback(message, isError = false) {
        const feedback = this.container.querySelector("[data-employee-feedback]");
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.toggle("app-error", isError);
    }
}
