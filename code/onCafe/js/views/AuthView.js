import { AuthService } from "../services/AuthService.js";

const authService = new AuthService();

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.dataset.state = isError ? "error" : "success";
}

const passwordInput = document.querySelector("#password");
const togglePassword = document.querySelector("#togglePassword");
if (passwordInput && togglePassword) {
    togglePassword.addEventListener("click", () => {
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        togglePassword.textContent = isVisible ? "Hiện" : "Ẩn";
        togglePassword.setAttribute("aria-label", isVisible ? "Hiện mật khẩu" : "Ẩn mật khẩu");
        togglePassword.setAttribute("aria-pressed", String(!isVisible));
    });
}

const loginForm = document.querySelector("#loginForm");
if (loginForm) {
    const message = document.querySelector("#loginMessage");
    const forgotPassword = document.querySelector("#forgotPassword");

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = loginForm.querySelector('button[type="submit"]');
        button.disabled = true;
        forgotPassword.hidden = true;
        showMessage(message, "Đang đăng nhập...");

        try {
            const formData = new FormData(loginForm);
            const result = await authService.login({
                email: formData.get("email"),
                password: formData.get("password")
            });
            const profile = await authService.getMyProfile(result.user.id);

            showMessage(message, "Đăng nhập thành công. Đang chuyển trang...");
            const redirectToMenu = new URLSearchParams(window.location.search).get("redirect") === "menu";

            // Admin và thu ngân đều dùng màn hình quản lý nhân viên.
            // Chỉ tài khoản khách hàng mới được chuyển sang khu vực mua hàng.
            if (profile.role === "admin" || profile.role === "cashier") {
                window.location.href = "../index.html";
            } else {
                window.location.href = redirectToMenu ? "./menu.html" : "./home.html";
            }
        } catch (error) {
            showMessage(
                message,
                error.message || "Không thể đăng nhập. Vui lòng thử lại.",
                true
            );
            forgotPassword.hidden = false;
        } finally {
            button.disabled = false;
        }
    });

    forgotPassword.addEventListener("click", async () => {
        const email = loginForm.elements.email.value;
        const redirectTo = new URL("./reset-password.html", window.location.href).href;
        forgotPassword.disabled = true;
        showMessage(message, "Đang gửi email đặt lại mật khẩu...");

        try {
            await authService.sendPasswordResetEmail(email, redirectTo);
            showMessage(
                message,
                "Nếu email này đã đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu."
            );
        } catch (error) {
            showMessage(
                message,
                error.message || "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.",
                true
            );
        } finally {
            forgotPassword.disabled = false;
        }
    });
}

const resetPasswordForm = document.querySelector("#resetPasswordForm");
if (resetPasswordForm) {
    const message = document.querySelector("#resetPasswordMessage");
    const submitButton = resetPasswordForm.querySelector('button[type="submit"]');

    try {
        const user = await authService.getCurrentUser();
        if (!user) {
            submitButton.disabled = true;
            showMessage(
                message,
                "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một email mới.",
                true
            );
        }
    } catch (error) {
        submitButton.disabled = true;
        showMessage(
            message,
            error.name === "AuthSessionMissingError"
                ? "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu một email mới."
                : error.message || "Không thể xác thực liên kết đặt lại mật khẩu.",
            true
        );
    }

    resetPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        showMessage(message, "Đang cập nhật mật khẩu...");

        try {
            const formData = new FormData(resetPasswordForm);
            await authService.updatePassword(formData.get("password"));
            showMessage(message, "Mật khẩu đã được cập nhật. Đang chuyển đến trang đăng nhập...");
            window.setTimeout(() => {
                window.location.href = "./login.html";
            }, 1200);
        } catch (error) {
            showMessage(
                message,
                error.message || "Không thể cập nhật mật khẩu. Vui lòng thử lại.",
                true
            );
            submitButton.disabled = false;
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
