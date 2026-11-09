# Thông báo đơn hàng theo thời gian thực (WebSocket) – Tài liệu học và bảo trì

Tài liệu này giải thích chức năng **thông báo cho nhân viên khi có đơn mới và khi đơn hoàn tất**, dành cho người mới học WebSocket. Đọc theo thứ tự: phần 1–2 là kiến thức nền, phần 3–5 chỉ vào code thật của dự án, phần 6–8 là cách chạy, gỡ lỗi và tự luyện tập.

## 1. WebSocket là gì?

### Cách thông thường: HTTP hỏi – đáp

Trình duyệt **hỏi**, máy chủ **trả lời**, rồi kết nối đóng. Máy chủ không thể tự nói trước. Nếu muốn biết có đơn mới, trình duyệt phải hỏi lại liên tục (gọi là *polling*):

```
Trình duyệt: Có đơn mới không?   Máy chủ: Chưa.
Trình duyệt: Có đơn mới không?   Máy chủ: Chưa.
Trình duyệt: Có đơn mới không?   Máy chủ: Có, đơn ON-12!
```

Cách này đơn giản nhưng lãng phí (đa số lần hỏi đều "chưa") và chậm (phải đợi tới lần hỏi tiếp theo).

### WebSocket: mở một đường dây điện thoại

Trình duyệt mở **một kết nối và giữ nó mở**. Từ đó **cả hai bên đều có thể gửi tin bất cứ lúc nào**, máy chủ không cần đợi bị hỏi:

```
Trình duyệt ──(mở kết nối, giữ nguyên)──► Máy chủ
Máy chủ: "Có đơn mới ON-12!"   ← chủ động đẩy xuống, gần như tức thì
```

Ví dụ WebSocket thuần có sẵn trong trình duyệt (chỉ để hiểu, dự án không dùng trực tiếp):

```js
const socket = new WebSocket("wss://example.com/chat"); // wss = WebSocket có mã hóa, như https
socket.onopen = () => socket.send("xin chào");           // kết nối xong thì gửi tin
socket.onmessage = (event) => console.log(event.data);   // có tin từ máy chủ gửi xuống
socket.onclose = () => console.log("mất kết nối");       // kết nối đóng
```

Điều cần nhớ: **kết nối có thể đứt bất cứ lúc nào** (mạng yếu, máy ngủ, máy chủ khởi động lại). Vì vậy code thật luôn phải có kế hoạch cho lúc mất kết nối – xem phần 5.

## 2. Supabase Realtime và kiến trúc của dự án

Dự án dùng Supabase, và Supabase đã có sẵn dịch vụ **Realtime chạy trên WebSocket**. Bạn không tự viết máy chủ WebSocket; chỉ dùng thư viện `supabase-js` để nghe một **kênh** (channel).

Có nhiều kiểu dùng Realtime. Dự án chọn **Broadcast trên kênh riêng (private channel)** vì:

- **Bảo mật:** nhân viên không có quyền đọc trực tiếp bảng `orders` (họ đọc qua hàm RPC), nên kiểu "nghe thay đổi của bảng" không gửi được cho họ. Kênh riêng cho phép đặt luật: *chỉ admin/seller/cashier mới được nghe*.
- **Gọn:** cơ sở dữ liệu gửi đúng những trường cần hiển thị (mã đơn, tên khách, tổng tiền…), không lộ cả dòng dữ liệu.

### Luồng đi của một đơn hàng

```
Khách bấm "Đặt hàng"
        │
        ▼
Hàm RPC tạo đơn  ──► INSERT vào bảng orders
                              │
                              ▼  (trigger trong cơ sở dữ liệu tự chạy)
                   oncafe_broadcast_order_event()
                   gọi realtime.send(...) vào kênh "oncafe:staff-orders"
                              │
                              ▼  (Supabase Realtime, qua WebSocket)
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
 Trình duyệt nhân viên A                Trình duyệt nhân viên B
 (đã đăng nhập, đang mở trang)          (kiểm tra RLS: là nhân viên → được nhận)
          │
          ▼
 Chuông + thông báo nổi + âm báo
```

Vì trigger gắn vào **bảng orders**, nó bắt được **mọi** nguồn thay đổi: khách đặt online, nhân viên lập đơn quầy, nhân viên đổi trạng thái, và cả tác vụ tự hoàn tất đơn giao hàng sau 30 phút.

## 3. Các file và vai trò

Dự án theo mô hình Model – Repository – Service – View – Controller (xem README). Chức năng này tách như sau:

| File | Vai trò | Biết về WebSocket? |
|---|---|---|
| `supabase/migrations/20261109110000_staff_order_realtime_notifications.sql` | Trigger phát sự kiện + luật RLS cho kênh | Phía **máy chủ gửi** |
| `js/repositories/OrderRealtimeRepo.js` | Mở/đóng kênh WebSocket, nhận sự kiện | **Có – chỉ file này** |
| `js/repositories/NotificationStateRepo.js` | Lưu trạng thái trong Local Storage (đã báo chưa, lịch sử, âm báo) | Không |
| `js/models/OrderNotification.js` | Định nghĩa "một thông báo" và nội dung chữ | Không |
| `js/services/OrderChangeDetector.js` | So sánh danh sách đơn cũ/mới để tìm thay đổi | Không |
| `js/services/OrderNotificationService.js` | "Bộ não": nhận sự kiện, chống trùng, dự phòng khi mất kết nối | Không (nhận từ repository) |
| `js/views/admin/notifications/*.js` | Chuông, thông báo nổi, âm thanh, thông báo trình duyệt | Không |
| `js/controllers/admin/OrderNotificationController.js` | Lắp ráp tất cả lại với nhau | Không |
| `js/controllers/admin/AdminController.js` | Chỉ thêm vài dòng để bật chức năng | Không |

**Lợi ích của việc tách:** nếu sau này muốn đổi sang công nghệ khác (ví dụ Firebase), chỉ cần viết lại **một file** `OrderRealtimeRepo.js`; các file còn lại không đổi. Việc kiểm thử cũng dễ vì mỗi file làm một việc.

## 4. Đọc code then chốt

### 4.1. Máy chủ gửi sự kiện (migration)

```sql
perform realtime.send(
  jsonb_build_object('type', v_type, 'actor', auth.uid(), 'order', ...),  -- nội dung gửi
  'order_' || v_type,          -- tên sự kiện: order_new hoặc order_completed
  'oncafe:staff-orders',       -- tên kênh (topic)
  true                         -- true = kênh riêng (private)
);
```

- `actor` là người thực hiện thao tác. Trình duyệt dùng nó để **không tự báo cho chính mình**.
- Toàn bộ nằm trong khối `begin ... exception when others` để **lỗi gửi thông báo không bao giờ làm hỏng việc đặt hàng**.
- Luật nghe kênh nằm ở `create policy ... on realtime.messages`: chỉ ai thỏa `oncafe_is_staff()` mới nhận được.

### 4.2. Trình duyệt mở kênh (`OrderRealtimeRepo.js`)

```js
const channel = this.client.channel("oncafe:staff-orders", { config: { private: true } });
channel.on("broadcast", { event: "order_new" }, (message) => onEvent(message.payload));
channel.subscribe((status) => onStatusChange(status));
```

Đọc như sau: "Mở kênh riêng tên `oncafe:staff-orders`. Khi có tin `order_new` thì gọi `onEvent`. Khi trạng thái kết nối đổi thì gọi `onStatusChange`." Các trạng thái hay gặp: `SUBSCRIBED` (đã nối), `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`.

Trước đó code lấy mã đăng nhập (`access_token`) và đưa cho Realtime (`setAuth`) để máy chủ biết bạn là ai và kiểm tra luật RLS.

### 4.3. Bộ não xử lý (`OrderNotificationService.js`)

Hàm `deliver()` là nơi mọi thông báo phải đi qua:

```js
if (this.stateRepository.hasSeen(notification.key)) continue;   // đã báo rồi → bỏ qua (chống trùng)
this.stateRepository.addSeen(notification.key);                 // đánh dấu đã báo
if (notification.actor === this.currentUserId) continue;        // chính mình làm → không báo
fresh.push(notification);                                       // còn lại mới báo
```

## 5. Vì sao còn "đồng bộ dự phòng"?

WebSocket không đảm bảo luôn nối. Nếu chỉ dựa vào nó, nhân viên sẽ **lỡ đơn** trong lúc mạng đứt. Service xử lý bằng ba lớp:

1. **Khi mới mở trang:** lấy danh sách đơn một lần làm "mốc". Lần đầu chỉ ghi nhận, không báo các đơn có sẵn.
2. **Khi kết nối (lại) thành công (`SUBSCRIBED`):** lấy danh sách đơn và so với mốc để **bù** những đơn phát sinh lúc mất kết nối (`OrderChangeDetector.js`).
3. **Khi đang mất kết nối:** cứ 15 giây hỏi lại một lần (polling). Khi đang nối bình thường thì chỉ đối soát thưa (5 phút/lần) như lưới an toàn.

Cả sự kiện tức thời lẫn đồng bộ đều đi qua `deliver()` nên **một đơn chỉ báo đúng một lần** dù có hai đường cùng phát hiện. Trên chuông có dòng trạng thái "Đang nhận thông báo trực tiếp" hoặc "Đang kiểm tra định kỳ" để bạn biết đang ở chế độ nào.

## 6. Cách đưa vào chạy

1. **Áp dụng migration** `20261109110000_staff_order_realtime_notifications.sql` lên Supabase (SQL Editor hoặc `supabase db push`), giống các migration khác.
2. Trong Supabase: **Realtime** phải được bật cho dự án. Chức năng dùng `realtime.send` và chính sách trên `realtime.messages`, có trong các bản Supabase hiện hành.
3. Triển khai frontend như bình thường (GitLab Pages). Không cần thêm biến môi trường hay Edge Function.
4. **Thử bằng hai trình duyệt:** một cửa sổ đăng nhập nhân viên (mở trang bất kỳ trong khu vực quản trị), một cửa sổ ẩn danh đăng nhập khách và đặt hàng. Cửa sổ nhân viên phải hiện thông báo trong khoảng một giây. Sau đó hoàn tất đơn bằng tài khoản nhân viên khác để thấy thông báo "đã hoàn tất".

## 7. Gỡ lỗi

- **Xem WebSocket tận mắt:** mở DevTools (F12) → tab **Network** → lọc **WS**. Bạn sẽ thấy kết nối `.../realtime/v1/websocket`; bấm vào, tab **Messages** hiện từng tin đi và đến. Đây là cách học WebSocket nhanh nhất.
- **Chuông luôn báo "Đang kiểm tra định kỳ":** kênh chưa nối được. Kiểm tra đã chạy migration chưa, tài khoản có đúng vai trò nhân viên không (bảng `profiles`), và Console có lỗi không.
- **Có đơn mới nhưng không thông báo:** xem trigger có tồn tại không (`select tgname from pg_trigger where tgname = 'trg_oncafe_broadcast_order_event';`) và có cảnh báo "Không gửi được thông báo đơn hàng" trong log của Supabase không.
- **Không nghe thấy âm báo:** trình duyệt thường chặn âm thanh cho đến khi người dùng bấm vào trang ít nhất một lần.

## 8. Bài tập tự luyện

Cấu trúc tách file giúp việc mở rộng rất rõ ràng. Gợi ý theo độ khó:

1. **Dễ – đổi âm báo hoặc thời gian hiện thông báo nổi:** sửa `NotificationSound.js` (tần số) hoặc hằng số `TOAST_DURATION_MS` trong `NotificationToasts.js`.
2. **Vừa – thông báo khi khách hủy đơn:**
   - Migration: trong `oncafe_broadcast_order_event()` thêm nhánh `elsif new.status = 'cancelled' ...` với `v_type := 'cancelled'`; tên sự kiện sẽ là `order_cancelled`.
   - `OrderNotification.js`: thêm `CANCELLED` vào `NOTIFICATION_TYPE` và nội dung chữ.
   - `OrderRealtimeRepo.js`: thêm `"order_cancelled"` vào `ORDER_EVENTS`.
   - `OrderChangeDetector.js`: thêm điều kiện cho đồng bộ dự phòng.
3. **Khó – thông báo khi khách xác nhận thanh toán QR:** tương tự bài 2 nhưng nghe thay đổi của `payment_status`; nhớ cập nhật trigger sang `after insert or update of status, payment_status`.
4. **Nâng cao – cho khách hàng nhận thông báo "đơn của bạn đã sẵn sàng":** cần kênh riêng theo từng khách (ví dụ `oncafe:customer:<id>`), luật RLS khác, và một bộ controller/view cho trang `my-orders`. Có thể dùng lại `OrderRealtimeRepo` và `NotificationStateRepo`.

## 9. Giới hạn cần biết

- Thông báo chỉ hiện khi nhân viên **đang mở trang quản trị** (tab có thể ở nền). Không có thông báo khi đã đóng hẳn trình duyệt; muốn vậy cần Web Push, là một chức năng riêng.
- Lịch sử thông báo và các khóa "đã báo" lưu trong Local Storage của từng trình duyệt, nên thông báo ở máy này không đồng bộ sang máy khác.
- Tính năng này được kiểm thử tự động bằng `python-tests/tests/test_order_notifications.py` với client Supabase giả. Việc chạy với Supabase thật cần bạn thử theo phần 6.
