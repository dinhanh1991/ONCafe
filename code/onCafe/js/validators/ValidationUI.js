/**
 * Hiển thị lỗi kiểm tra dữ liệu ngay dưới trường nhập tương ứng.
 */
const formIds = new WeakMap();
let nextFormId = 0;

export class ValidationUI {
    static getNativeErrors(form) {
        const errors = {};
        for (const field of form.elements) {
            if (!field.name || !field.willValidate || field.validity.valid) continue;

            const validity = field.validity;
            let message = "Giá trị chưa hợp lệ. Vui lòng kiểm tra lại.";
            if (validity.valueMissing) {
                message = field.tagName === "SELECT"
                    ? "Vui lòng chọn một giá trị."
                    : "Vui lòng điền vào trường này.";
            } else if (validity.typeMismatch && field.type === "email") {
                message = "Vui lòng nhập địa chỉ email hợp lệ.";
            } else if (validity.typeMismatch && field.type === "url") {
                message = "Vui lòng nhập đường dẫn hợp lệ.";
            } else if (validity.tooShort) {
                message = `Vui lòng nhập ít nhất ${field.minLength} ký tự.`;
            } else if (validity.tooLong) {
                message = `Vui lòng nhập không quá ${field.maxLength} ký tự.`;
            } else if (validity.rangeUnderflow) {
                message = `Giá trị không được nhỏ hơn ${field.min}.`;
            } else if (validity.rangeOverflow) {
                message = `Giá trị không được lớn hơn ${field.max}.`;
            } else if (validity.stepMismatch) {
                message = `Vui lòng nhập giá trị theo bước ${field.step}.`;
            } else if (validity.patternMismatch) {
                message = "Giá trị chưa đúng định dạng yêu cầu.";
            } else if (validity.badInput) {
                message = "Vui lòng nhập giá trị hợp lệ.";
            }

            errors[field.name] = message;
        }
        return errors;
    }

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
            const anchor = field.closest(".password-field") || field;
            anchor.insertAdjacentElement("afterend", error);
            firstInvalid ||= field;
        }

        firstInvalid?.focus();
        return firstInvalid;
    }

    static clearField(field) {
        if (!field) return;
        field.classList.remove("is-invalid");
        field.removeAttribute("aria-invalid");
        const error = [...(field.form?.querySelectorAll("[data-validation-error]") || [])]
            .find((item) => item.dataset.validationError === (field.name || field.id));
        if (!error) return;
        this.removeDescription(field, error.id);
        error.remove();
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
        form.noValidate = true;
        form.addEventListener("input", (event) => this.clearField(event.target));
        form.addEventListener("change", (event) => this.clearField(event.target));
        form.addEventListener("submit", (event) => {
            const errors = this.getNativeErrors(form);
            if (Object.keys(errors).length === 0) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.showErrors(form, errors);
        }, true);
    }
}
