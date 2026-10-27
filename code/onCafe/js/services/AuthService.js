import { supabase } from "../config/supabase.js";

export class AuthService {
    async register({ fullName, email, password }) {
        const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
                data: {
                    full_name: fullName.trim()
                }
            }
        });

        if (error) throw error;

        return {
            user: data.user,
            needsEmailConfirmation: Boolean(data.user && !data.session)
        };
    }

    async login({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
        });

        if (error) throw error;
        return data;
    }

    async getMyProfile(userId) {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", userId)
            .single();

        if (error) throw error;
        return data;
    }

    async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }

    async getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
    }
}
