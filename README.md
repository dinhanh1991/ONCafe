# ONCafe – Ứng dụng quản lý quán đồ uống

ONCafe là ứng dụng web quản lý danh mục đồ uống, được xây dựng bằng HTML, CSS và JavaScript ES Modules theo hướng tách lớp để dễ mở rộng.

> **Trạng thái hiện tại:** phần quản lý sản phẩm sử dụng dữ liệu mẫu lưu trong bộ nhớ. Dữ liệu sẽ được đặt lại khi tải lại trang. Supabase, quản lý đơn hàng, khách hàng và nhân viên chưa được tích hợp hoàn chỉnh.

## Chức năng hiện có

- Hiển thị danh sách sản phẩm mẫu.
- Tìm kiếm theo tên hoặc danh mục.
- Thêm, chỉnh sửa và xóa sản phẩm.
- Kiểm tra dữ liệu cơ bản: tên, danh mục, giá và số lượng.
- Hiển thị giá theo định dạng tiền Việt Nam.
- Hiển thị ảnh sản phẩm từ đường dẫn tương đối hoặc URL.

## Công nghệ

- HTML5
- CSS3
- JavaScript ES Modules
- Git và GitHub

## Cấu trúc thư mục

```text
code/onCafe/
├── index.html
├── css/
│   └── style.css
└── js/
    ├── app.js
    ├── config/
    ├── import-export/
    ├── models/
    ├── repositories/
    ├── services/
    ├── utils/
    ├── validators/
    └── views/
```

- **models**: mô hình dữ liệu.
- **repositories**: truy cập và quản lý dữ liệu.
- **services**: xử lý nghiệp vụ.
- **views**: giao diện và tương tác người dùng.
- **validators**: kiểm tra dữ liệu đầu vào.
- **utils**: các hàm tiện ích.

## Chạy ứng dụng trên máy

1. Clone repository:

   ```bash
   git clone https://github.com/dinhanh1991/ONCafe.git
   ```

2. Mở thư mục `ONCafe` bằng VS Code.
3. Mở file `code/onCafe/index.html`.
4. Dùng tiện ích **Live Server** để chạy trang web. Nên dùng máy chủ HTTP thay vì mở trực tiếp bằng giao thức `file://`, vì ứng dụng sử dụng JavaScript modules.

## Triển khai GitLab Pages

Repository hiện nằm trên GitHub. File `.gitlab-ci.yml` trong dự án chuẩn bị cấu hình để xuất nội dung trong `code/onCafe/` thành website tĩnh trên GitLab Pages khi mã nguồn được đưa lên một repository GitLab và CI/CD được bật.

Sau khi pipeline chạy thành công, mở **Deploy → Pages** trong dự án GitLab để lấy địa chỉ website được cấp cho dự án.

## Lưu ý và hướng phát triển

- Dữ liệu sản phẩm hiện chỉ nằm trong bộ nhớ, chưa được lưu bền vững.
- Cần kiểm thử CRUD trên trình duyệt trước khi dùng thực tế.
- Các bước tiếp theo: kết nối Supabase với Row Level Security (RLS), xây dựng quản lý đơn hàng/khách hàng/nhân viên, bổ sung kiểm thử và hoàn thiện nhập/xuất dữ liệu.
- Không đưa khóa bí mật hoặc khóa `service_role` của Supabase vào mã nguồn frontend công khai.

## Repository

https://github.com/dinanh1991/ONCafe
