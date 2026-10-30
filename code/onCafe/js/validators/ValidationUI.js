/**
 * Hiển thị lỗi kiểm tra dữ liệu ngay dưới trường nhập tương ứng.
 */
const formIds = new WeakMap();
let nextFormId = 0;

export class ValidationUI {
    static showErrors(form, errors = {}) {
        this.clearErrors(form);
        let formId = formIds.get(form);
        if (!formId) {
            formId = `validation-form-${++nextFormId}`;
            formIds.set(form, formId);
        }
        let firstInvalid = null;

        for (const [fieldName, message] of Object.entries(errors)) {
            const field = form.elements.namedItem(fieldName);
            if (!field || !("classList" in field)) continue;

            field.classList.add("is-invalid");
            field.setAttribute("aria-invalid", "true");

            const error = document.createElement("small");
            error.className = "field-error";
            error.dataset.validationError = fieldName;
            error.id = `${formId}-error-${fieldName}`;
            error.setAttribute("role", "alert");
            error.textContent = message;

            const descriptions = new Set(
                (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)
            );
            descriptions.add(error.id);
            field.setAttribute("aria-describedby", [...descriptions].join(" "));
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
        if (next?.matches("[data-validation-error]")) {
            this.removeDescription(field, next.id);
            next.remove();
        }
    }

    static clearErrors(form) {
        if (!form) return;
        form.querySelectorAll("[data-validation-error]").forEach((error) => {
            const field = form.elements.namedItem(error.dataset.validationError);
            if (field && "classList" in field) this.removeDescription(field, error.id);
            error.remove();
        });
        form.querySelectorAll(".is-invalid").forEach((field) => {
            field.classList.remove("is-invalid");
            field.removeAttribute("aria-invalid");
        });
    }

    static removeDescription(field, descriptionId) {
        const descriptions = (field.getAttribute("aria-describedby") || "")
            .split(/\s+/)
            .filter((id) => id && id !== descriptionId);
        if (descriptions.length) {
            field.setAttribute("aria-describedby", descriptions.join(" "));
        } else {
            field.removeAttribute("aria-describedby");
        }
    }

    static bind(form) {
        if (!form || form.dataset.validationBound === "true") return;
        form.dataset.validationBound = "true";
        form.addEventListener("input", (event) => this.clearField(event.target));
        form.addEventListener("change", (event) => this.clearField(event.target));
    }
}
