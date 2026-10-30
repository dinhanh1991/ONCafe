import { supabase } from "../config/supabase.js";

const nav = document.querySelector("#customerNav");

if (nav) {
    const loginLink = nav.querySelector("[data-auth-link]");

    async function updateNavigation(session) {
        nav.querySelector(".nav-user-name")?.remove();
        nav.querySelector(".nav-orders-link")?.remove();
        nav.querySelector(".nav-logout-button")?.remove();

        if (!session?.user) {
            if (loginLink) loginLink.hidden = false;
            return;
        }

        if (loginLink) loginLink.hidden = true;

        const user = session.user;
        let displayName = user.user_metadata?.full_name?.trim();

        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();

        if (profile?.full_name?.trim()) {
            displayName = profile.full_name.trim();
        }

        if (!displayName) {
            displayName = user.email?.split("@")[0] || "Khách hàng";
        }

        const name = document.createElement("span");
        name.className = "nav-user-name";
        name.textContent = "Xin chào, " + displayName;
        nav.appendChild(name);

        const ordersLink = document.createElement("a");
        ordersLink.className = "nav-orders-link";
        ordersLink.href = "./my-orders.html";
        ordersLink.textContent = "Đơn hàng của tôi";
        nav.appendChild(ordersLink);

        const logoutButton = document.createElement("button");
        logoutButton.type = "button";
        logoutButton.className = "nav-logout-button";
        logoutButton.textContent = "Đăng xuất";
        logoutButton.addEventListener("click", async () => {
            logoutButton.disabled = true;
            logoutButton.textContent = "Đang đăng xuất...";
            const { error } = await supabase.auth.signOut();

            if (error) {
                logoutButton.disabled = false;
                logoutButton.textContent = "Đăng xuất";
                alert("Không thể đăng xuất: " + error.message);
                return;
            }

            window.location.reload();
        });
        nav.appendChild(logoutButton);
    }

    const { data: { session } } = await supabase.auth.getSession();
    await updateNavigation(session);

    supabase.auth.onAuthStateChange((_event, session) => {
        void updateNavigation(session);
    });
}
