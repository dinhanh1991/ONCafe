import { AuthService } from "../../services/AuthService.js";

const authService = new AuthService();

const nav = document.querySelector("#customerNav");

if (nav) {
    const loginLink = nav.querySelector("[data-auth-link]");

    function setIconLabel(element, iconName, label) {
        const icon = document.createElement("i");
        icon.className = `bi ${iconName}`;
        icon.setAttribute("aria-hidden", "true");

        const text = document.createElement("span");
        text.className = "nav-link-label";
        text.textContent = label;

        element.replaceChildren(icon, text);
        return text;
    }

    async function updateNavigation(session) {
        nav.querySelector(".nav-user-name")?.remove();
        nav.querySelector(".nav-orders-link")?.remove();
        nav.querySelector(".nav-profile-link")?.remove();
        nav.querySelector(".nav-logout-button")?.remove();

        if (!session?.user) {
            if (loginLink) {
                loginLink.hidden = false;
                setIconLabel(loginLink, "bi-box-arrow-in-right", "Đăng nhập");
            }
            return;
        }

        if (loginLink) loginLink.hidden = true;

        const user = session.user;
        let displayName = user.user_metadata?.full_name?.trim();

        const profile = await authService.getMyProfileIfExists(user.id);

        if (profile?.full_name?.trim()) {
            displayName = profile.full_name.trim();
        }

        if (!displayName) {
            displayName = user.email?.split("@")[0] || "Khách hàng";
        }

        const name = document.createElement("span");
        name.className = "nav-user-name";
        name.title = `Xin chào, ${displayName}`;
        setIconLabel(name, "bi-person-check", `Xin chào, ${displayName}`);
        nav.appendChild(name);

        const profileLink = document.createElement("a");
        profileLink.className = "nav-profile-link nav-account-link";
        profileLink.href = "./profile.html";
        profileLink.setAttribute("aria-label", "Thông tin cá nhân");
        setIconLabel(profileLink, "bi-person-vcard", "Thông tin cá nhân");
        if (window.location.pathname.endsWith("/profile.html")) {
            profileLink.setAttribute("aria-current", "page");
        }
        nav.appendChild(profileLink);

        const ordersLink = document.createElement("a");
        ordersLink.className = "nav-orders-link nav-account-link";
        ordersLink.href = "./my-orders.html";
        ordersLink.setAttribute("aria-label", "Đơn hàng của tôi");
        setIconLabel(ordersLink, "bi-receipt", "Đơn hàng của tôi");
        if (window.location.pathname.endsWith("/my-orders.html")) {
            ordersLink.setAttribute("aria-current", "page");
        }
        nav.appendChild(ordersLink);

        const logoutButton = document.createElement("button");
        logoutButton.type = "button";
        logoutButton.className = "nav-logout-button";
        const logoutLabel = setIconLabel(logoutButton, "bi-box-arrow-right", "Đăng xuất");
        logoutButton.addEventListener("click", async () => {
            logoutButton.disabled = true;
            logoutLabel.textContent = "Đang đăng xuất...";
            try {
                await authService.logout();
            } catch (error) {
                logoutButton.disabled = false;
                logoutLabel.textContent = "Đăng xuất";
                alert("Không thể đăng xuất: " + error.message);
                return;
            }

            window.location.reload();
        });
        nav.appendChild(logoutButton);
    }

    const session = await authService.getCurrentSession();
    await updateNavigation(session);

    authService.onAuthStateChange((_event, nextSession) => {
        void updateNavigation(nextSession);
    });
}
