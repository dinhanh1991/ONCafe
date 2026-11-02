import { supabase } from "../config/supabase.js";

export class CustomerMenuRepository {
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    async getAvailableProducts() {
        const { data, error } = await this.supabase
            .from("products")
            .select("id, name, price, image_url, is_available, quantity, categories(name)")
            .eq("is_available", true)
            .order("name", { ascending: true });

        if (error) throw error;
        return data || [];
    }
}
