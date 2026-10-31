export const currencyFormatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
});

export const numberFormatter = new Intl.NumberFormat("vi-VN");

export function getLocalDateValue() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function formatPeriodLabel(value, period) {
    const [year, month, day] = value.split("-").map(Number);
    if (period === "day") return `Ngày ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    if (period === "month") return `Tháng ${String(month).padStart(2, "0")}/${year}`;
    return `Năm ${year}`;
}

export function getPreviousAnchorDate(value, period) {
    const [year, month, day] = value.split("-").map(Number);
    const date = period === "day"
        ? new Date(Date.UTC(year, month - 1, day - 1))
        : period === "month"
            ? new Date(Date.UTC(year, month - 2, 1))
            : new Date(Date.UTC(year - 1, month - 1, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getComparisonLabel(currentValue, previousValue) {
    const current = Number(currentValue) || 0;
    const previous = Number(previousValue) || 0;
    if (previous === 0) return current === 0 ? "Không phát sinh ở cả hai kỳ" : "Phát sinh mới so với kỳ trước";
    const change = ((current - previous) / previous) * 100;
    const prefix = change > 0 ? "Tăng " : change < 0 ? "Giảm " : "Không đổi ";
    return `${prefix}${Math.abs(change).toFixed(1)}% so với kỳ trước`;
}
