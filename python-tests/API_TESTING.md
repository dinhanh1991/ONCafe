# Kiểm thử API Supabase

File kiểm thử: `tests/test_supabase_api.py`

Bộ test sử dụng **Pytest và thư viện chuẩn của Python** (`urllib`), không cần cài thêm Postman, Requests hoặc Vitest.

## Các trường hợp được kiểm tra

| Phương thức / tình huống | Nội dung |
|---|---|
| GET | Đọc danh sách sản phẩm bằng tài khoản nhân viên đã đăng nhập |
| POST | Tạo danh mục và sản phẩm thử nghiệm |
| PATCH | Cập nhật tên, giá và số lượng sản phẩm |
| DELETE | Xóa sản phẩm thử nghiệm sau khi kiểm tra |
| Dữ liệu sai | Gửi giá không phải số và kiểm tra API trả HTTP 400 |
| Chưa đăng nhập | Kiểm tra API từ chối thao tác ghi bằng anon key |
| Mất kết nối | Kiểm tra lỗi kết nối được phát sinh khi máy chủ không truy cập được |

**Lưu ý về PUT:** Supabase sử dụng PostgREST. Với thao tác cập nhật một bản ghi, API chuẩn dùng phương thức **PATCH**; vì vậy bài test cập nhật dùng PATCH thay vì PUT.

## 1. Chuẩn bị môi trường test

Nên dùng **một Supabase project riêng dành cho kiểm thử**, không dùng cơ sở dữ liệu đang phục vụ người dùng thật. Bài test CRUD sẽ tạo tạm một danh mục và một sản phẩm, sau đó xóa chúng.

Tạo một tài khoản nhân viên có vai trò `admin` hoặc `seller` trong project test. Tài khoản này cần có quyền quản lý sản phẩm và danh mục.

Cần chuẩn bị:
- Project URL của Supabase test.
- Publishable key/anon key của project test.
- Email và mật khẩu tài khoản nhân viên test.

Không dùng `service_role key`. Không đưa mật khẩu hoặc key riêng vào Git.

## 2. Khai báo biến môi trường trên Windows PowerShell

Mở PowerShell tại thư mục dự án và thay các giá trị mẫu bằng thông tin của **project test**:

```powershell
$env:ONCAFE_RUN_SUPABASE_API_TESTS = "1"
$env:ONCAFE_TEST_SUPABASE_URL = "https://YOUR-TEST-PROJECT.supabase.co"
$env:ONCAFE_TEST_SUPABASE_ANON_KEY = "YOUR_TEST_PUBLISHABLE_OR_ANON_KEY"
$env:ONCAFE_TEST_STAFF_EMAIL = "test-admin@example.com"
$env:ONCAFE_TEST_STAFF_PASSWORD = "YOUR_TEST_ACCOUNT_PASSWORD"
```

Các biến trên chỉ có hiệu lực trong cửa sổ PowerShell hiện tại. Không cần tạo file chứa mật khẩu trong repository.

## 3. Chạy kiểm thử API

Từ thư mục gốc ONCafe:

```powershell
cd python-tests
python -m pytest -v tests/test_supabase_api.py
```

Nếu chưa bật biến `ONCAFE_RUN_SUPABASE_API_TESTS=1` hoặc thiếu cấu hình, các bài test cần Supabase sẽ được **SKIPPED** để tránh vô tình gọi API.

Bài test mất kết nối không cần tài khoản Supabase và vẫn có thể chạy độc lập.

## 4. Chạy toàn bộ bộ kiểm thử hiện tại

Các bài test giao diện cũ dùng Playwright và cần ứng dụng chạy tại `http://127.0.0.1:5500`. Hãy khởi động Live Server với thư mục gốc là `public/onCafe`, sau đó chạy:

```powershell
python -m pytest -v
```

## 5. Cách đọc kết quả

- `PASSED`: bài kiểm thử đạt.
- `FAILED`: có lỗi cần xem nội dung assertion và phản hồi HTTP.
- `SKIPPED`: chưa bật hoặc chưa khai báo đủ cấu hình kiểm thử Supabase.

Các bài test API xác nhận phản hồi thực tế từ Supabase project được cấu hình. Chúng không thay thế việc kiểm tra chính sách RLS, migration và luồng giao diện trên môi trường triển khai.
## Kết quả kiểm thử tích hợp Supabase REST API

**Ngày kiểm thử:** 05/11/2026

**Môi trường kiểm thử:**
- Hệ điều hành: Windows 11
- Python: 3.12.10
- Pytest: 9.1.1
- Cơ sở dữ liệu: Supabase PostgreSQL
- Phương thức kiểm thử: Supabase REST API

**Lệnh thực thi:**

```powershell
python -m pytest -v -rs python-tests/tests/test_supabase_api.py
```

**Kết quả tổng hợp:**

| STT | Test case | Kết quả |
|---|---|---|
| 1 | test_supabase_rest_connection_returns_products | PASSED |
| 2 | test_supabase_rest_rejects_write_without_staff_login | PASSED |
| 3 | test_supabase_products_post_get_patch_delete_and_invalid_data | PASSED |
| 4 | test_supabase_api_connection_failure_is_reported | PASSED |

**Tổng kết:**
- Tổng số test: 4
- Thành công: 4
- Thất bại: 0
- Lỗi: 0
- Tỷ lệ thành công: 100%

**Đánh giá:**

Các bài kiểm thử xác nhận kết nối Supabase REST API, xác thực tài khoản nhân viên, kiểm soát quyền truy cập dữ liệu, các thao tác CRUD sản phẩm và xử lý lỗi kết nối API hoạt động đúng theo các trường hợp đã kiểm thử.
