// Tạo và hiển thị trạng thái tải theo nhận diện Coffee Motion của ONCafe.
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
}[character]));

// Trả về HTML hoạt ảnh tách cà phê có thông báo truy cập được bằng trình đọc màn hình.
export function createCoffeeLoadingMarkup(message = "Đang tải dữ liệu...", { compact = false } = {}) {
    const safeMessage = escapeHtml(message);
    return `
        <span class="coffee-loading${compact ? " coffee-loading-compact" : ""}" role="status" aria-live="polite" aria-label="${safeMessage}">
            <span class="coffee-loading-cup" aria-hidden="true">
                <svg viewBox="0 0 72 72" focusable="false">
                    <path class="coffee-steam coffee-steam-one" d="M25 19c-5-5 5-7 0-13" />
                    <path class="coffee-steam coffee-steam-two" d="M36 17c-5-5 5-7 0-13" />
                    <path class="coffee-steam coffee-steam-three" d="M47 19c-5-5 5-7 0-13" />
                    <path class="coffee-liquid" d="M17 31c7-4 13 4 20 0s13 4 20 0v5H17z" />
                    <path class="coffee-cup" d="M15 29h43l-4 27a7 7 0 0 1-7 6H26a7 7 0 0 1-7-6z" />
                    <path class="coffee-handle" d="M58 35h4a7 7 0 0 1 0 14h-6" />
                    <path class="coffee-saucer" d="M12 64h50" />
                </svg>
            </span>
            <span class="coffee-loading-copy">${safeMessage}</span>
        </span>`;
}

// Thay nội dung vùng tải bằng hoạt ảnh dùng chung.
export function renderCoffeeLoading(element, message, options) {
    if (!element) return;
    element.innerHTML = createCoffeeLoadingMarkup(message, options);
    element.setAttribute("aria-busy", "true");
}

// Kết thúc trạng thái tải trước khi render dữ liệu hoặc thông báo khác.
export function clearCoffeeLoading(element) {
    if (!element) return;
    element.removeAttribute("aria-busy");
}
