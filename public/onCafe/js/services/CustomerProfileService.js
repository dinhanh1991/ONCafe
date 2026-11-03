// Xử lý nghiệp vụ đọc và cập nhật hồ sơ khách hàng.
import { CustomerProfileRepository } from "../repositories/CustomerProfileRepo.js";
import { CustomerValidator } from "../validators/CustomerValidator.js";

export class CustomerProfileService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(repository = new CustomerProfileRepository()) {
        this.repository = repository;
    }

    // Lấy hồ sơ của người dùng hiện tại.
    async getMyProfile(userId) {
        if (!userId) throw new Error("Bạn cần đăng nhập để xem thông tin cá nhân.");
        return this.repository.getMyProfile(userId);
    }

    // Lưu các thay đổi hồ sơ của khách hàng.
    async updateMyProfile(profile) {
        const fullName = String(profile.fullName || "").trim();
        const phone = String(profile.phone || "").trim();
        const address = String(profile.address || "").trim();

        if (!fullName) {
            throw new Error("Vui lòng nhập họ và tên.");
        }
        if (fullName.length < 2 || fullName.length > 100) {
            throw new Error("Họ và tên phải có từ 2 đến 100 ký tự.");
        }

        const validation = CustomerValidator.validate({ phone }, { phoneRequired: true });
        if (!validation.isValid) {
            throw new Error(validation.errors.phone);
        }
        if (!address) {
            throw new Error("Vui lòng nhập địa chỉ.");
        }
        if (address.length > 250) {
            throw new Error("Địa chỉ không được vượt quá 250 ký tự.");
        }

        return this.repository.updateMyProfile({ fullName, phone, address });
    }
}
