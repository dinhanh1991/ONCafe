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
        this.busy = false;
        this.editingId = null;

        this.container.addEventListener("input", (event) => {
            if (event.target.matches("[data-employee-search]")) {
                this.searchTerm = event.target.value;
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

        if (!employees.length) {
            list.innerHTML = '<tr><td class="empty-state" colspan="4">Chưa có nhân viên phù hợp.</td></tr>';
            return;
        }

        list.innerHTML = employees.map((employee) => `
            <tr>
                <td class="product-name">${escapeHtml(employee.full_name)}</td>
                <td>${escapeHtml(employee.email)}</td>
                <td><span class="status status-active">Thu ngân</span></td>
                <td class="row-actions">
                    <button class="button button-small" type="button" data-employee-action="edit" data-id="${escapeHtml(employee.id)}" ${this.busy ? "disabled" : ""}>Sửa</button>
                    <button class="button button-small button-danger" type="button" data-employee-action="delete" data-id="${escapeHtml(employee.id)}" ${this.busy ? "disabled" : ""}>Xóa</button>
                </td>
            </tr>`).join("");
    }

    handleClick(event) {
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
        const formData = new FormData(form);
        const employee = {
            fullName: String(formData.get("fullName") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            password: String(formData.get("password") || "")
        };
        const wasEditing = this.editingId !== null;
        if (wasEditing) employee.id = this.editingId;

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
            this.closeForm();
            this.setFeedback(wasEditing ? "Đã cập nhật thông tin nhân viên." : "Đã tạo tài khoản nhân viên.");
            this.renderList();
        } catch (error) {
            console.error("Không thể lưu thông tin nhân viên:", error);
            form.querySelector("[data-employee-form-error]").textContent =
                error.message || "Không thể lưu thông tin nhân viên.";
        } finally {
            this.setBusy(false);
        }
    }

    async deleteEmployee(id) {
        const employee = this.employees.find((item) => String(item.id) === String(id));
        if (!employee) return;
        if (!window.confirm(`Xóa tài khoản nhân viên ${employee.full_name} (${employee.email})? Tài khoản đăng nhập sẽ bị xóa và không thể khôi phục.`)) return;

        this.setBusy(true);
        this.setFeedback("Đang xóa tài khoản nhân viên...");
        try {
            await this.onDelete(id);
            this.employees = this.employees.filter((item) => String(item.id) !== String(id));
            this.setFeedback("Đã xóa tài khoản nhân viên.");
            this.renderList();
        } catch (error) {
            console.error("Không thể xóa nhân viên:", error);
            this.setFeedback(error.message || "Không thể xóa nhân viên.", true);
        } finally {
            this.setBusy(false);
        }
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
