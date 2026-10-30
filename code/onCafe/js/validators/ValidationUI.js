/**
 * Hiển thị lỗi kiểm tra dữ liệu ngay dưới trường nhập tương ứng.
 */
export class ValidationUI {
    static showErrors(form, errors = {}) {
        this.clearErrors(form);
        let firstInvalid = null;

        for (const [fieldName, message] of Object.entries(errors)) {
            const field = form.elements.namedItem(fieldName);
            if (!field || !("classList" in field)) continue;

            field.classList.add("is-invalid");
            field.setAttribute("aria-invalid", "true");

            const error = document.createElement("small");
            error.className = "field-error";
            error.dataset.validationError = fieldName;
            error.setAttribute("role", "alert");
            error.textContent = message;

            field.insertAdjacentElement("afterend", error);
            firstInvalid ||= field;
        }

        firstInvalid?.focus();
        return firstInvalid;
    }

    static clearField(field) {
        if (!field) return;
        field.classList.remove("is-invalid");
        field.removeAttribute("aria-invalid");
        const next = field.nextElementSibling;
        if (next?.matches("[data-validation-error]")) next.remove();
    }

    static clearErrors(form) {
        if (!form) return;
        form.querySelectorAll("[data-validation-error]").forEach((error) => error.remove());
        form.querySelectorAll(".is-invalid").forEach((field) => {
            field.classList.remove("is-invalid");
            field.removeAttribute("aria-invalid");
        });
    }

    static bind(form) {
        if (!form || form.dataset.validationBound === "true") return;
        form.dataset.validationBound = "true";
        form.addEventListener("input", (event) => this.clearField(event.target));
        form.addEventListener("change", (event) => this.clearField(event.target));
    }
}
