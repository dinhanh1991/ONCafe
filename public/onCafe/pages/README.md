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

index.html                 # Trang quản trị, giữ ở thư mục gốc
```

## Quy ước

- `auth/`: đăng nhập, đăng ký và đặt lại mật khẩu.
- `customer/`: trang chủ, thực đơn, hồ sơ cá nhân, đơn hàng và xác nhận QR.
- `index.html` tại thư mục gốc: điểm vào của hệ thống quản trị.

Khi di chuyển trang, cần cập nhật đường dẫn tương đối tới CSS, JavaScript, ảnh và các trang liên kết. Các trang con hiện dùng đường dẫn tương đối từ thư mục phân hệ.
