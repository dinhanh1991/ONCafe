document.body.id = document.body.id || "top";

const footer = document.createElement("footer");
footer.className = "site-footer";
footer.innerHTML = `
    <div class="site-footer-main">
        <a class="site-footer-brand" href="#" aria-label="ONCafe - Trang chủ">ONCafe<span>.</span></a>
        <p class="site-footer-tagline">Một chút thư thả, một ngày thật vui.</p>
        <nav class="site-footer-links" aria-label="Liên kết cuối trang">
            <a data-footer-home href="#">Trang chủ</a>
            <a data-footer-menu href="#">Thực đơn</a>
            <a data-footer-login href="#">Tài khoản</a>
        </nav>
    </div>
    <div class="site-footer-bottom">
        <p>© <span data-footer-year></span> ONCafe. Tất cả quyền được bảo lưu.</p>
        <a data-footer-top href="#top">Trở về đầu trang ↑</a>
    </div>
`;

const path = window.location.pathname;
const isCustomerPage = path.includes("/pages/customer/");
const isNestedPage = path.includes("/pages/");
const customerBase = isCustomerPage ? "./" : isNestedPage ? "../customer/" : "./pages/customer/";
const authBase = isNestedPage ? "../auth/" : "./pages/auth/";

footer.querySelector(".site-footer-brand").href = customerBase + "home.html";
footer.querySelector("[data-footer-home]").href = customerBase + "home.html";
footer.querySelector("[data-footer-menu]").href = customerBase + "menu.html";
footer.querySelector("[data-footer-login]").href = authBase + "login.html";
footer.querySelector("[data-footer-year]").textContent = new Date().getFullYear();

document.body.append(footer);
