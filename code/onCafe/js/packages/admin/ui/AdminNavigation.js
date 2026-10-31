export function createNavButton(iconClass, label, value) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-nav-item";
    button.dataset.section = value;
    button.innerHTML = `<span class="admin-nav-icon" aria-hidden="true"><i class="bi ${iconClass}"></i></span><span>${label}</span>`;
    return button;
}
