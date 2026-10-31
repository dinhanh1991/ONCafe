import { supabase } from "../config/supabase.js";

/**
 * AuthRepository
 * Chịu trách nhiệm giao tiếp với Supabase Auth và bảng profiles.
 */
export class AuthRepository {
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    async register({ fullName, email, password }) {
        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;
        return data;
    }

    async login({ email, password }) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    }

    async sendPasswordResetEmail(email, redirectTo) {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
            redirectTo
        });
        if (error) throw error;
    }

    async updatePassword(password) {
        const { error } = await this.supabase.auth.updateUser({ password });
        if (error) throw error;
    }

    async getMyProfile(userId) {
        const { data, error } = await this.supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", userId)
            .single();

        if (error) throw error;
        return data;
    }

    async getMyProfileIfExists(userId) {
        const { data, error } = await this.supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async logout() {
        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
    }

    async getCurrentSession() {
        const { data, error } = await this.supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    }

    onAuthStateChange(callback) {
        return this.supabase.auth.onAuthStateChange(callback);
    }

    async getCurrentUser() {
        const { data, error } = await this.supabase.auth.getUser();
        if (error) throw error;
        return data.user;
    }
}
