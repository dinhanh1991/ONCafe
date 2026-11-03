# Tổ chức trang HTML ONCafe

Các trang được nhóm theo phân hệ để dễ tìm kiếm và bảo trì.

```text
pages/
├── auth/
│   ├── login.html
│   ├── register.html
│   └── reset-password.html
└── customer/
    ├── home.html
    ├── menu.html
    ├── profile.html
    ├── my-orders.html
    └── qr-confirm.html

index.html                 # Điểm vào website; chuyển đến trang chủ khách hàng
admin/
    dashboard.html         # Tổng quan khu vực nhân viên (yêu cầu đăng nhập)
```

## Quy ước

- `auth/`: đăng nhập, đăng ký và đặt lại mật khẩu.
- `customer/`: trang chủ, thực đơn, hồ sơ cá nhân, đơn hàng và xác nhận QR.
- `index.html` tại thư mục gốc: điểm vào công khai, chuyển người dùng đến `customer/home.html`.
- `admin/`: khu vực quản lý nội bộ; trang tổng quan nhân viên là `admin/dashboard.html`.

Khi di chuyển trang, cần cập nhật đường dẫn tương đối tới CSS, JavaScript, ảnh và các trang liên kết. Các trang con hiện dùng đường dẫn tương đối từ thư mục phân hệ.
