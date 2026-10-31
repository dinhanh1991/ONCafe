import { AuthRepository } from "../repositories/AuthRepo.js";

export class AuthService {
    constructor(repository = new AuthRepository()) {
        this.repository = repository;
    }

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

    async login({ email, password }) {
        return this.repository.login({
            email: String(email || "").trim(),
            password
        });
    }

    async sendPasswordResetEmail(email, redirectTo) {
        return this.repository.sendPasswordResetEmail(
            String(email || "").trim(),
            redirectTo
        );
    }

    async updatePassword(password) {
        return this.repository.updatePassword(password);
    }

    async getMyProfile(userId) {
        return this.repository.getMyProfile(userId);
    }

    async getMyProfileIfExists(userId) {
        return this.repository.getMyProfileIfExists(userId);
    }

    async logout() {
        return this.repository.logout();
    }

    async getCurrentSession() {
        return this.repository.getCurrentSession();
    }

    onAuthStateChange(callback) {
        return this.repository.onAuthStateChange(callback);
    }

    async getCurrentUser() {
        return this.repository.getCurrentUser();
    }
}
