import { supabase } from "../config/supabase.js";

export class RevenueReportRepository {
    async getReport(period, anchorDate) {
        const { data, error } = await supabase.rpc("oncafe_cashier_revenue_report", {
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
