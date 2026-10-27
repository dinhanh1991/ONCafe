import { AuthService } from "../services/AuthService.js";

const authService = new AuthService();

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.dataset.state = isError ? "error" : "success";
}

const loginForm = document.querySelector("#loginForm");
if (loginForm) {
    const message = document.querySelector("#loginMessage");
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = loginForm.querySelector('button[type="submit"]');
        button.disabled = true;
        showMessage(message, "Đang đăng nhập...");

        try {
            const formData = new FormData(loginForm);
            const result = await authService.login({
                email: formData.get("email"),
                password: formData.get("password")
            });
            const profile = await authService.getMyProfile(result.user.id);

            showMessage(message, "Đăng nhập thành công. Đang chuyển trang...");
            window.location.href = profile.role === "admin"
                ? "../index.html"
                : "./home.html";
        } catch (error) {
            showMessage(
                message,
                error.message || "Không thể đăng nhập. Vui lòng thử lại.",
                true
            );
        } finally {
            button.disabled = false;
        }
    });
}

const registerForm = document.querySelector("#registerForm");
if (registerForm) {
    const message = document.querySelector("#registerMessage");
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = registerForm.querySelector('button[type="submit"]');
        button.disabled = true;
        showMessage(message, "Đang tạo tài khoản...");

        try {
            const formData = new FormData(registerForm);
            const result = await authService.register({
                fullName: formData.get("fullName"),
                email: formData.get("email"),
                password: formData.get("password")
            });

            if (result.needsEmailConfirmation) {
                showMessage(
                    message,
                    "Đăng ký thành công. Hãy kiểm tra email để xác nhận tài khoản trước khi đăng nhập."
                );
            } else {
                showMessage(message, "Đăng ký thành công. Đang chuyển đến trang đăng nhập...");
                window.setTimeout(() => {
                    window.location.href = "./login.html";
                }, 1000);
            }
            registerForm.reset();
        } catch (error) {
            showMessage(
                message,
                error.message || "Không thể đăng ký. Vui lòng thử lại.",
                true
            );
        } finally {
            button.disabled = false;
        }
    });
}
