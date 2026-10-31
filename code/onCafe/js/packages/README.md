# ONCafe JavaScript packages

Các module được nhóm theo nghiệp vụ để dễ tìm kiếm và bảo trì.

```text
js/
├── app.js                         # Entry point cũ, giữ nguyên đường dẫn HTML
├── menu.js                        # Entry point cũ, giữ nguyên đường dẫn HTML
├── packages/
│   ├── admin/
│   │   ├── index.js               # Điều phối khu vực nhân viên
│   │   ├── controllers/
│   │   │   ├── AdminOverviewController.js
│   │   │   └── AdminSectionController.js
│   │   ├── ui/
│   │   │   ├── AccessMessage.js   # Giao diện thông báo truy cập
│   │   │   └── AdminNavigation.js # Tạo nút điều hướng
│   └── customer/
│       ├── index.js               # Thực đơn, giỏ hàng và checkout
│       └── ui/
│           └── OrderDialogs.js    # Hộp thoại đặt hàng/thanh toán
├── services/
├── repositories/
├── views/
│   ├── admin/                     # Các màn hình quản trị và bán hàng
│   ├── auth/                      # Các màn hình xác thực
│   └── customer/                  # Các thành phần giao diện khách hàng
├── validators/
└── config/
```

## Quy ước

- `packages/admin`: điều phối luồng làm việc và UI dùng riêng cho Admin, Seller, Cashier.
- `packages/customer`: xử lý thực đơn, giỏ hàng, đặt hàng và QR.
- `services` và `repositories`: giữ các lớp nghiệp vụ và truy cập dữ liệu dùng chung.
- `views/admin`, `views/customer` và `views/auth`: nhóm màn hình theo nghiệp vụ, dùng chung một thư mục gốc.
- `app.js` và `menu.js` là entry point tương thích ngược để không phải sửa đường dẫn trong HTML hiện tại.

Các màn hình quản trị được giữ cùng một nhóm để tránh chia đôi giữa `views` và `packages/admin/views`. Khi tổ chức lại thư mục, cần cập nhật cả import JavaScript và đường dẫn module trong HTML.
