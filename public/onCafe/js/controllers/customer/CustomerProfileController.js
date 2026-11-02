import { AuthService } from "../../services/AuthService.js";
import { CustomerProfileService } from "../../services/CustomerProfileService.js";
import { CustomerProfileView } from "../../views/customer/CustomerProfileView.js";

const authService = new AuthService();
const profileService = new CustomerProfileService();
const app = document.querySelector("#customerProfile");

if (!app) throw new Error("Không tìm thấy vùng hiển thị hồ sơ khách hàng.");

const profileView = new CustomerProfileView(app, {
    onLoad: async () => {
        const session = await authService.getCurrentSession();
        if (!session?.user) {
            const redirect = encodeURIComponent("profile");
            window.location.href = `../auth/login.html?redirect=${redirect}`;
            return null;
        }

        const profile = await profileService.getMyProfile(session.user.id);
        return { profile, email: session.user.email };
    },
    onSave: (profile) => profileService.updateMyProfile(profile)
});

void profileView.render();
