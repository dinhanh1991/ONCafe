# Tổ chức CSS ONCafe

Thư mục này chứa CSS được tách theo nhóm giao diện/chức năng.

## Cấu trúc

- `admin/`: giao diện hệ thống quản trị, nhân viên, sản phẩm, đơn hàng, bán hàng tại quầy và báo cáo.
- `shared/`: thành phần dùng chung giữa nhiều khu vực, ví dụ hộp thoại và thông báo validation.

## Quy tắc sử dụng

1. Chỉ thêm kiểu giao diện vào module đúng chức năng.
2. Không đưa CSS riêng của một màn hình vào `style.css`.
3. `../css/index.css` là file tập hợp các module giao diện quản trị; giữ nguyên thứ tự import để tránh thay đổi thứ tự ưu tiên CSS.
4. `../css/style.css` là file nền dùng chung cho các trang khách hàng và nạp module dùng chung.
5. Các file `home.css`, `menu.css`, `my-orders.css`, `auth.css` tiếp tục quản lý giao diện riêng của từng trang khách hàng/xác thực.

## Khi thêm màn hình mới

Tạo file CSS trong nhóm phù hợp, sau đó thêm `@import` vào file tổng hợp tương ứng hoặc liên kết trực tiếp từ HTML nếu đó là trang độc lập.
