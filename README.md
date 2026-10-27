# ONCafe – Ứng dụng quản lý quán đồ uống

ONCafe là ứng dụng web quản lý danh mục đồ uống, được xây dựng bằng HTML, CSS và JavaScript ES Modules theo hướng tách lớp để dễ mở rộng.

> **Trạng thái hiện tại:** phần quản lý sản phẩm sử dụng dữ liệu mẫu lưu trong bộ nhớ. Dữ liệu sẽ được đặt lại khi tải lại trang. Trang chủ và thực đơn hiện là giao diện tĩnh; Supabase, xác thực tài khoản, quản lý đơn hàng, khách hàng và nhân viên chưa được tích hợp hoàn chỉnh.

## Chức năng hiện có

- Trang chủ giới thiệu ONCafe.
- Trang thực đơn hiển thị các đồ uống mẫu.
- Giao diện đăng nhập và đăng ký (chưa có xử lý xác thực).
- Hiển thị danh sách sản phẩm mẫu trong trang quản lý.
- Tìm kiếm theo tên hoặc danh mục.
- Thêm, chỉnh sửa và xóa sản phẩm trong bộ nhớ.
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
├── assets/
│   └── images/
├── pages/
│   ├── home.html
│   ├── menu.html
│   ├── login.html
│   └── register.html
├── css/
│   ├── style.css
│   ├── index.css
│   ├── home.css
│   ├── menu.css
│   ├── auth.css
│   ├── login.css
│   └── register.css
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

### Vai trò của các thư mục

- **pages**: các trang dành cho khách hàng và tài khoản.
- **css**: kiểu dáng dùng chung và kiểu dáng riêng của từng trang.
- **assets/images**: hình ảnh đồ uống.
- **models**: mô hình dữ liệu.
- **repositories**: truy cập và quản lý dữ liệu.
- **services**: xử lý nghiệp vụ.
- **views**: giao diện và tương tác người dùng.
- **validators**: kiểm tra dữ liệu đầu vào.
- **utils**: các hàm tiện ích.
- **config**: cấu hình tích hợp dịch vụ.

## Chạy ứng dụng trên máy

1. Clone repository:

   ```bash
   git clone https://github.com/dinhanh1991/ONCafe.git
   ```

2. Mở thư mục `ONCafe` bằng VS Code.
3. Mở thư mục `code/onCafe/`.
4. Dùng tiện ích **Live Server** để chạy `index.html` hoặc mở trang `pages/home.html`. Nên dùng máy chủ HTTP thay vì mở trực tiếp bằng giao thức `file://`, vì ứng dụng quản lý sản phẩm sử dụng JavaScript modules.

## Triển khai GitLab Pages

Repository hiện nằm trên GitHub. File `.gitlab-ci.yml` chuẩn bị cấu hình để xuất nội dung trong `code/onCafe/` thành website tĩnh trên GitLab Pages khi mã nguồn được đưa lên một repository GitLab và CI/CD được bật.

Sau khi pipeline chạy thành công, mở **Deploy → Pages** trong dự án GitLab để lấy địa chỉ website được cấp cho dự án.

## Lưu ý và hướng phát triển

- Dữ liệu quản lý sản phẩm hiện chỉ nằm trong bộ nhớ, chưa được lưu bền vững.
- Trang thực đơn đang hiển thị dữ liệu mẫu tĩnh, chưa đọc dữ liệu từ trang quản lý.
- Đăng nhập và đăng ký hiện mới là giao diện, chưa xác thực tài khoản.
- Cần kiểm thử CRUD trên trình duyệt trước khi dùng thực tế.
- Các bước tiếp theo: kết nối Supabase với Row Level Security (RLS), xây dựng xác thực và phân quyền, đồng bộ thực đơn với cơ sở dữ liệu, rồi phát triển đơn hàng/khách hàng/nhân viên.
- Không đưa khóa bí mật hoặc khóa `service_role` của Supabase vào mã nguồn frontend công khai.

## Repository

https://github.com/dinhanh1991/ONCafe
