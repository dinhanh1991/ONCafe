// Lấy dữ liệu doanh thu từ cơ sở dữ liệu để lập báo cáo.
import { supabase } from "../config/supabase.js";

export class RevenueReportRepository {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(supabaseClient = supabase) {
        this.supabase = supabaseClient;
    }

    // Tải dữ liệu báo cáo theo kỳ được chọn.
    async getReport(period, anchorDate) {
        const { data, error } = await this.supabase.rpc("oncafe_cashier_revenue_report", {
            p_period: period,
            p_anchor_date: anchorDate
        });

        if (error) throw error;
        if (!data || typeof data !== "object") {
            throw new Error("Dữ liệu báo cáo doanh thu không đúng định dạng.");
        }

        return data;
    }
}
