# ONCafe JavaScript structure

JavaScript được tổ chức theo trách nhiệm kỹ thuật ở cấp `js/`, không sử dụng tầng `packages/`.

```text
js/
├── app.js
├── menu.js
├── controllers/
│   ├── admin/
│   │   ├── AdminController.js
│   │   ├── AdminOverviewController.js
│   │   └── AdminSectionController.js
│   └── customer/
│       └── CustomerMenuController.js
├── config/
├── models/
├── repositories/
├── services/
├── ui/
│   ├── admin/
│   └── customer/
├── utils/
│   └── admin/
├── validators/
└── views/
    ├── admin/
    ├── auth/
    └── customer/
```

## Quy ước

- `controllers/`: điều phối luồng tương tác và khởi tạo các thành phần của từng khu vực.
- `models/`: mô hình dữ liệu.
- `repositories/`: truy cập và lưu trữ dữ liệu.
- `services/`: xử lý nghiệp vụ.
- `ui/`: thành phần giao diện nhỏ theo phạm vi sử dụng.
- `utils/`: hàm tiện ích; chỉ tạo thư mục con khi tiện ích thuộc một phạm vi cụ thể.
- `validators/`: kiểm tra dữ liệu đầu vào.
- `views/`: các màn hình, phân nhóm theo khu vực sử dụng.
- `config/`: cấu hình và khởi tạo dịch vụ hạ tầng.

Không tạo bản sao các tầng `services`, `repositories`, `utils` hoặc `validators` bên trong từng khu vực. Khi di chuyển file, cập nhật import và giữ nguyên hành vi nghiệp vụ.
