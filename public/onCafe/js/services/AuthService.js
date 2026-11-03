// Xử lý nghiệp vụ đăng nhập, đăng ký và phiên xác thực.
import { AuthRepository } from "../repositories/AuthRepo.js";

export class AuthService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(repository = new AuthRepository()) {
        this.repository = repository;
    }

    // Tạo tài khoản khách hàng mới.
    async register({ fullName, email, password }) {
        const data = await this.repository.register({
            fullName: String(fullName || "").trim(),
            email: String(email || "").trim(),
            password
        });

        return {
            user: data.user,
            needsEmailConfirmation: Boolean(data.user && !data.session)
        };
    }

    // Xác thực tài khoản và tạo phiên đăng nhập.
    async login({ email, password }) {
        return this.repository.login({
            email: String(email || "").trim(),
            password
        });
    }

    // Gửi email chứa liên kết đặt lại mật khẩu.
    async sendPasswordResetEmail(email, redirectTo) {
        return this.repository.sendPasswordResetEmail(
            String(email || "").trim(),
            redirectTo
        );
    }

    // Cập nhật mật khẩu cho tài khoản hiện tại.
    async updatePassword(password) {
        return this.repository.updatePassword(password);
    }

    // Lấy hồ sơ của người dùng hiện tại.
    async getMyProfile(userId) {
        return this.repository.getMyProfile(userId);
    }

    // Lấy hồ sơ của người dùng nếu hồ sơ đã tồn tại.
    async getMyProfileIfExists(userId) {
        return this.repository.getMyProfileIfExists(userId);
    }

    // Kết thúc phiên đăng nhập hiện tại.
    async logout() {
        return this.repository.logout();
    }

    // Lấy phiên đăng nhập hiện tại.
    async getCurrentSession() {
        return this.repository.getCurrentSession();
    }

    // Đăng ký nhận thông báo khi trạng thái xác thực thay đổi.
    onAuthStateChange(callback) {
        return this.repository.onAuthStateChange(callback);
    }

    // Lấy thông tin tài khoản đang đăng nhập.
    async getCurrentUser() {
        return this.repository.getCurrentUser();
    }
}
