document.body.id = document.body.id || "top";

const path = window.location.pathname;
const isCustomerPage = path.includes("/pages/customer/");
const isAdminWorkspace = path.includes("/pages/admin/")
    || (document.querySelector("#app") && document.querySelector("#logoutButton"));
const isNestedPage = path.includes("/pages/");
const customerBase = isCustomerPage ? "./" : isNestedPage ? "../customer/" : "./pages/customer/";
const authBase = isNestedPage ? "../auth/" : "./pages/auth/";
const adminBase = path.includes("/pages/admin/") ? "./" : "./pages/admin/";

const footer = document.createElement("footer");
footer.className = "site-footer";

if (isAdminWorkspace) {
    footer.innerHTML = `
        <div class="site-footer-main">
            <a class="site-footer-brand" href="${adminBase}dashboard.html" aria-label="ONCafe - Tổng quan nhân viên">ONCafe<span>.</span></a>
            <p class="site-footer-tagline">Không gian làm việc ONCafe.</p>
            <nav class="site-footer-links" aria-label="Điều hướng nhân viên">
                <a href="${adminBase}dashboard.html">Tổng quan nhân viên</a>
                <a href="${adminBase}orders.html">Quản lý đơn hàng</a>
                <a href="${adminBase}profile.html">Hồ sơ nhân viên</a>
            </nav>
        </div>
        <div class="site-footer-bottom">
            <p>© <span data-footer-year></span> ONCafe. Tất cả quyền được bảo lưu.</p>
            <a data-footer-top href="#top">Trở về đầu trang ↑</a>
        </div>
    `;
} else {
    footer.innerHTML = `
        <div class="site-footer-main">
            <a class="site-footer-brand" href="${customerBase}home.html" aria-label="ONCafe - Trang chủ">ONCafe<span>.</span></a>
            <p class="site-footer-tagline">Một chút thư thả, một ngày thật vui.</p>
            <nav class="site-footer-links" aria-label="Liên kết cuối trang">
                <a data-footer-home href="${customerBase}home.html">Trang chủ</a>
                <a data-footer-menu href="${customerBase}menu.html">Thực đơn</a>
                <a data-footer-login href="${authBase}login.html">Tài khoản</a>
            </nav>
        </div>
        <div class="site-footer-bottom">
            <p>© <span data-footer-year></span> ONCafe. Tất cả quyền được bảo lưu.</p>
            <a data-footer-top href="#top">Trở về đầu trang ↑</a>
        </div>
    `;
}

footer.querySelector("[data-footer-year]").textContent = new Date().getFullYear();
document.body.append(footer);
