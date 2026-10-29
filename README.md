# ONCafe – Ứng dụng quản lý quán đồ uống

ONCafe là ứng dụng web quản lý danh mục đồ uống, được xây dựng bằng HTML, CSS và JavaScript ES Modules theo hướng tách lớp để dễ mở rộng.

> **Trạng thái hiện tại:** ứng dụng sử dụng Supabase cho xác thực, sản phẩm và đơn hàng. Khu vực nhân viên dành cho quản trị viên hỗ trợ quản lý tài khoản thu ngân; các thao tác tài khoản được xử lý trong Supabase Edge Function với quyền quản trị phía máy chủ.

## Chức năng hiện có

- Trang chủ giới thiệu ONCafe.
- Trang thực đơn hiển thị đồ uống đang mở bán.
- Đăng nhập, đăng ký và đặt lại mật khẩu bằng Supabase Auth.
- Quản lý sản phẩm, ảnh sản phẩm và tồn kho.
- Tìm kiếm, thêm, chỉnh sửa và xóa sản phẩm trong khu vực quản lý.
- Quản lý đơn hàng và cập nhật trạng thái đơn.
- Khu vực quản trị có sidebar riêng với Tổng quan, Quản lý đồ uống, Quản lý nhân viên, Chi tiết doanh thu và Quản lý đơn hàng.
- Quản lý đồ uống có danh sách, tìm kiếm, thêm, xem chi tiết, chỉnh sửa và xóa.
- Quản trị viên có thể xem danh sách thu ngân, tạo tài khoản, sửa họ tên/email/mật khẩu và xóa tài khoản.
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
│   ├── register.html
│   └── reset-password.html
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
supabase/
└── functions/
    ├── admin-create-employee/
    └── admin-manage-employees/
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
- **supabase/functions**: các Edge Function có quyền quản trị, không chạy quyền này ở trình duyệt.

## Chạy ứng dụng trên máy

1. Clone repository:

   ```bash
   git clone https://github.com/dinhanh1991/ONCafe.git
   ```

2. Mở thư mục `ONCafe` bằng VS Code.
3. Mở thư mục `code/onCafe/`.
4. Dùng tiện ích **Live Server** để chạy `index.html` hoặc mở trang `pages/home.html`. Nên dùng máy chủ HTTP thay vì mở trực tiếp bằng giao thức `file://`, vì ứng dụng sử dụng JavaScript modules và Supabase.
5. Triển khai Edge Function quản lý nhân viên trước khi dùng CRUD nhân viên:

   ```bash
   supabase functions deploy admin-manage-employees
   ```

   Function cần các biến môi trường Supabase `SUPABASE_URL`, `SUPABASE_ANON_KEY` (hoặc `SUPABASE_PUBLISHABLE_KEY`) và `SUPABASE_SERVICE_ROLE_KEY`. Chỉ cấu hình service-role key trong môi trường Supabase, tuyệt đối không đặt khóa này trong frontend.

## Triển khai GitLab Pages

Repository hiện nằm trên GitHub. File `.gitlab-ci.yml` chuẩn bị cấu hình để xuất nội dung trong `code/onCafe/` thành website tĩnh trên GitLab Pages khi mã nguồn được đưa lên một repository GitLab và CI/CD được bật.

Sau khi pipeline chạy thành công, mở **Deploy → Pages** trong dự án GitLab để lấy địa chỉ website được cấp cho dự án.

## Lưu ý và hướng phát triển

- Cần triển khai và kiểm thử Edge Function quản lý nhân viên trên dự án Supabase trước khi sử dụng các thao tác CRUD.
- Không đưa khóa bí mật hoặc khóa `service_role` của Supabase vào mã nguồn frontend công khai.

## Repository

https://github.com/dinhanh1991/ONCafe
