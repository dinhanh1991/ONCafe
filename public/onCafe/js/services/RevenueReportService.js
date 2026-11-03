// Điều phối nghiệp vụ tổng hợp và so sánh báo cáo doanh thu.
const ALLOWED_PERIODS = new Set(["day", "month", "year"]);

export class RevenueReportService {
    // Khởi tạo đối tượng và chuẩn bị trạng thái, phụ thuộc ban đầu.
    constructor(repository) {
        this.repository = repository;
    }

    // Tải dữ liệu báo cáo theo kỳ được chọn.
    async getReport(period, anchorDate) {
        if (!ALLOWED_PERIODS.has(period)) {
            throw new Error("Khoảng thời gian báo cáo không hợp lệ.");
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(anchorDate || ""))) {
            throw new Error("Ngày báo cáo không hợp lệ.");
        }
        return await this.repository.getReport(period, anchorDate);
    }
}