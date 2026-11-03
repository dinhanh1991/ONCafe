// Truy vấn danh sách món đang bán từ cơ sở dữ liệu.
import { supabase } from "../config/supabase.js";

export class CustomerMenuRepository {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    // Tải các sản phẩm đang được phép bán.
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
