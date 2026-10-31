# ONCafe JavaScript packages

Các module được nhóm theo nghiệp vụ để dễ tìm kiếm và bảo trì.

```text
js/
├── app.js                         # Entry point cũ, giữ nguyên đường dẫn HTML
├── menu.js                        # Entry point cũ, giữ nguyên đường dẫn HTML
├── packages/
│   ├── admin/
│   │   ├── index.js               # Điều phối khu vực nhân viên
│   │   ├── ui/
│   │   │   ├── AccessMessage.js   # Giao diện thông báo truy cập
│   │   │   └── AdminNavigation.js # Tạo nút điều hướng
│   │   └── views/
│   │       └── DashboardView.js   # Giao diện tổng quan theo vai trò
│   └── customer/
│       ├── index.js               # Thực đơn, giỏ hàng và checkout
│       └── ui/
│           └── OrderDialogs.js    # Hộp thoại đặt hàng/thanh toán
├── services/
├── repositories/
├── views/
├── validators/
└── config/
```

## Quy ước

- `packages/admin`: giao diện và điều phối luồng làm việc của Admin, Seller, Cashier.
- `packages/customer`: trải nghiệm khách hàng gồm thực đơn, giỏ hàng, đặt hàng và QR.
- `services` và `repositories`: giữ các lớp nghiệp vụ và truy cập dữ liệu dùng chung.
- `views`: các màn hình quản lý hiện có; chỉ chuyển vào package khi đã xác định rõ phạm vi sử dụng.
- `app.js` và `menu.js` là entry point tương thích ngược để không phải sửa đường dẫn trong HTML hiện tại.

Việc tách package được thực hiện từng bước. Không di chuyển hàng loạt hoặc thay đổi tên RPC, selector HTML, quyền truy cập và quy tắc nghiệp vụ trong cùng một lần refactor.
