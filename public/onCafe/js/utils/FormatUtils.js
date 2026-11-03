// Các hàm định dạng tiền tệ và thời gian dùng chung.
// Định dạng giá trị tiền tệ theo ngôn ngữ và loại tiền được chọn.
export function formatCurrency(value, currency = "VND") {
	const amount = Number(value);
	return new Intl.NumberFormat("vi-VN", {
		style: "currency",
		currency
	}).format(Number.isFinite(amount) ? amount : 0);
}

// Định dạng ngày giờ cho giao diện.
export function formatDate(value, options = {}) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "Chưa cập nhật";

	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "medium",
		...options
	}).format(date);
}
