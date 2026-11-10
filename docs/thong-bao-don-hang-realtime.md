# Thông báo cho nhân viên theo thời gian thực (WebSocket) – Tài liệu học và bảo trì

Tài liệu này giải thích chức năng **thông báo cho nhân viên**, dành cho người mới học WebSocket. Đọc theo thứ tự: phần 1–2 là kiến thức nền, phần 3–5 chỉ vào code thật của dự án, phần 6–9 là cách chạy, gỡ lỗi, tự luyện tập và giới hạn.

## Ai nhận thông báo nào?

| Thông báo | admin | seller | cashier |
|---|:-:|:-:|:-:|
| Có đơn hàng mới (online hoặc tại quầy) | ✅ | ✅ | ✅ |
| Đơn hàng hoàn tất | ✅ | ✅ | ✅ |
| Thêm / sửa / xóa đồ uống | ✅ | ✅ | ❌ |
| Nhân viên mới tham gia ("A đã tham gia") | ✅ | ✅ | ✅ |

Bảng này nằm ở **một chỗ duy nhất**: các mảng vai trò `array['admin', 'seller', ...]` trong migration `20261109170000_role_based_staff_notifications.sql`. Muốn đổi người nhận chỉ cần sửa mảng đó rồi chạy lại hàm.

Quy ước:
- **Sửa đồ uống** tính khi đổi tên, giá, mô tả, ảnh, danh mục hoặc trạng thái bán. Đổi **tồn kho** không tính, vì mỗi đơn hàng đều trừ/cộng tồn kho và sẽ gây báo liên tục.
- **Nhân viên mới tham gia** chỉ tính khi *thêm* (tài khoản chuyển từ khách thành nhân viên). Sửa thông tin, đổi vai trò giữa các nhân viên hay xóa nhân viên **không** báo.
- Người thực hiện thao tác **không bị báo chính việc mình vừa làm** (ví dụ seller sửa đồ uống thì seller đó không nhận thông báo, các nhân viên khác thì có).

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

Dự án dùng **Broadcast trên kênh riêng (private channel), mỗi vai trò một kênh**:

```
oncafe:role:admin      ← mọi admin nghe kênh này
oncafe:role:seller     ← mọi seller nghe kênh này
oncafe:role:cashier    ← mọi cashier nghe kênh này
```

Lý do:

- **Bảo mật:** nhân viên không có quyền đọc trực tiếp bảng `orders`, nên kiểu "nghe thay đổi của bảng" không dùng được. Kênh riêng cho phép đặt luật RLS: *mỗi người chỉ được nghe kênh đúng vai trò của mình*. Cashier không thể tự mở kênh của seller để nghe thông báo đồ uống.
- **Quyết định "ai nhận gì" nằm ở cơ sở dữ liệu**, không phải ở trình duyệt. Trình duyệt chỉ nghe kênh của mình và hiển thị mọi thứ nhận được, nên không thể bị "gian lận" bằng cách sửa JavaScript.
- **Dễ mở rộng:** thêm một loại thông báo mới chỉ cần thêm trigger phía cơ sở dữ liệu và một đoạn tạo nội dung ở `StaffNotification.js`. Phần kết nối WebSocket không phải sửa (nó nghe mọi sự kiện bằng `event: "*"`).

### Luồng đi của một thông báo (ví dụ seller sửa giá đồ uống)

```
Seller bấm "Lưu" trên trang đồ uống
        │
        ▼
UPDATE bảng products  (giá đổi)
        │
        ▼  (trigger trong cơ sở dữ liệu tự chạy)
oncafe_broadcast_menu_event()
  → oncafe_broadcast_to_roles(['admin','seller'], 'menu_updated', {...})
  → realtime.send(...) vào 2 kênh: oncafe:role:admin và oncafe:role:seller
        │
        ▼  (Supabase Realtime, qua WebSocket)
┌───────┴────────────────────┐
▼                            ▼
Trình duyệt admin         Trình duyệt seller khác
(đúng vai trò → được nhận) (người sửa thì tự bỏ qua vì actor = chính mình)
        │
        ▼
Chuông + thông báo nổi + âm báo
```

Cashier không có tên trong mảng `['admin','seller']` nên không nhận gì.

## 3. Các file và vai trò

Dự án theo mô hình Model – Repository – Service – View – Controller (xem README). Chức năng này tách như sau:

| File | Vai trò | Biết về WebSocket? |
|---|---|---|
| `supabase/migrations/20261109170000_role_based_staff_notifications.sql` | Trigger phát sự kiện + luật RLS cho kênh theo vai trò | Phía **máy chủ gửi** |
| `js/repositories/StaffRealtimeRepo.js` | Mở/đóng kênh WebSocket của vai trò, nhận sự kiện | **Có – chỉ file này** |
| `js/repositories/NotificationStateRepo.js` | Lưu trạng thái trong Local Storage (đã báo chưa, lịch sử, âm báo) | Không |
| `js/models/StaffNotification.js` | Định nghĩa "một thông báo" và nội dung chữ cho cả 3 nhóm | Không |
| `js/services/OrderChangeDetector.js` | So sánh danh sách đơn cũ/mới (đồng bộ dự phòng cho đơn hàng) | Không |
| `js/services/StaffNotificationService.js` | "Bộ não": nhận sự kiện, chống trùng, dự phòng khi mất kết nối | Không (nhận từ repository) |
| `js/views/admin/notifications/*.js` | Chuông, thông báo nổi, biểu tượng/màu, âm thanh, thông báo trình duyệt | Không |
| `js/controllers/admin/StaffNotificationController.js` | Lắp ráp tất cả lại với nhau | Không |
| `js/controllers/admin/AdminController.js` | Chỉ thêm vài dòng để bật chức năng | Không |

**Lợi ích của việc tách:** nếu sau này muốn đổi sang công nghệ khác (ví dụ Firebase), chỉ cần viết lại **một file** `StaffRealtimeRepo.js`; các file còn lại không đổi. Việc kiểm thử cũng dễ vì mỗi file làm một việc.

## 4. Đọc code then chốt

### 4.1. Máy chủ gửi sự kiện (migration)

Mọi trigger đều gọi một hàm chung, truyền vào danh sách vai trò nhận:

```sql
perform public.oncafe_broadcast_to_roles(
  array['admin', 'seller'],          -- AI nhận: chỉ admin và seller
  'menu_updated',                    -- tên sự kiện
  jsonb_build_object(...) || public.oncafe_notification_actor()   -- nội dung + người thực hiện
);
```

Bên trong hàm này lặp qua từng vai trò và gọi `realtime.send(payload, event, 'oncafe:role:' || vai_trò, true)` (`true` = kênh riêng).

- `actor` là người thực hiện thao tác; trình duyệt dùng nó để **không tự báo cho chính mình**. Khi thao tác do Edge Function hoặc SQL Editor thực hiện thì `actor` rỗng.
- Toàn bộ nằm trong khối `begin ... exception when others` để **lỗi gửi thông báo không bao giờ làm hỏng việc đặt hàng, sửa đồ uống hay thêm nhân viên**.
- Luật nghe kênh nằm ở `create policy ... on realtime.messages`: kênh phải đúng bằng `'oncafe:role:' || vai trò của người đang đăng nhập`.

Vì sao "nhân viên mới tham gia" bắt cả `UPDATE`? Edge Function `admin-manage-employees` tạo tài khoản trước (hệ thống tự tạo hồ sơ với vai trò `customer`), rồi mới nâng lên `admin/seller/cashier`. Trigger trên bảng `profiles` vì thế báo khi vai trò chuyển từ *không phải nhân viên* sang *nhân viên*, và không báo khi chỉ đổi qua lại giữa các vai trò nhân viên.

### 4.2. Trình duyệt mở kênh (`StaffRealtimeRepo.js`)

```js
const channel = this.client.channel("oncafe:role:seller", { config: { private: true } });
channel.on("broadcast", { event: "*" }, (message) => onEvent(message.payload));
channel.subscribe((status) => onStatusChange(status));
```

Đọc như sau: "Mở kênh riêng của vai trò mình. Khi có **bất kỳ** tin nào thì gọi `onEvent`. Khi trạng thái kết nối đổi thì gọi `onStatusChange`." Các trạng thái hay gặp: `SUBSCRIBED` (đã nối), `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`.

Trước đó code lấy mã đăng nhập (`access_token`) và đưa cho Realtime (`setAuth`) để máy chủ biết bạn là ai và kiểm tra luật RLS.

### 4.3. Bộ não xử lý (`StaffNotificationService.js`)

Hàm `deliver()` là nơi mọi thông báo phải đi qua:

```js
if (this.stateRepository.hasSeen(notification.key)) continue;   // đã báo rồi → bỏ qua (chống trùng)
this.stateRepository.addSeen(notification.key);                 // đánh dấu đã báo
if (notification.actor && notification.actor === this.currentUserId) continue;  // chính mình làm → không báo
fresh.push(notification);                                       // còn lại mới báo
```

**Khóa chống trùng** (`key`) khác nhau theo nhóm: đơn hàng dùng `loại:mã_đơn` (mỗi đơn chỉ báo "mới" một lần, "hoàn tất" một lần), còn đồ uống và nhân viên dùng mã sự kiện riêng (`event_id`). Nếu đồ uống cũng dùng khóa theo mã sản phẩm thì lần sửa thứ hai của cùng một đồ uống sẽ bị nuốt mất.

## 5. Vì sao còn "đồng bộ dự phòng" cho đơn hàng?

WebSocket không đảm bảo luôn nối. Nếu chỉ dựa vào nó, nhân viên sẽ **lỡ đơn** trong lúc mạng đứt. Service xử lý bằng ba lớp:

1. **Khi mới mở trang:** lấy danh sách đơn một lần làm "mốc". Lần đầu chỉ ghi nhận, không báo các đơn có sẵn.
2. **Khi kết nối (lại) thành công (`SUBSCRIBED`):** lấy danh sách đơn và so với mốc để **bù** những đơn phát sinh lúc mất kết nối (`OrderChangeDetector.js`).
3. **Khi đang mất kết nối:** cứ 15 giây hỏi lại một lần (polling). Khi đang nối bình thường thì chỉ đối soát thưa (5 phút/lần) như lưới an toàn.

Cả sự kiện tức thời lẫn đồng bộ đều đi qua `deliver()` nên **một đơn chỉ báo đúng một lần** dù có hai đường cùng phát hiện. Trên chuông có dòng trạng thái "Đang nhận thông báo trực tiếp" hoặc "Đang kiểm tra định kỳ" để bạn biết đang ở chế độ nào.

> Thông báo **đồ uống** và **nhân viên mới** chỉ đi qua WebSocket, không có đồng bộ bù: nếu nhân viên đang mất mạng đúng lúc đó thì sẽ không thấy (xem phần 9).

## 6. Cách đưa vào chạy

Có **hai** migration, chạy theo thứ tự:

1. `20261109110000_staff_order_realtime_notifications.sql` – thông báo đơn hàng (kênh chung, bản đầu tiên).
2. `20261109170000_role_based_staff_notifications.sql` – **thay thế** kênh chung bằng kênh theo vai trò, thêm thông báo đồ uống và nhân viên mới.

Cách chạy: Supabase SQL Editor hoặc `supabase db push`. Cả hai viết theo kiểu chạy lại nhiều lần không lỗi. **Thứ tự triển khai:** đưa giao diện mới lên trước hoặc cùng lúc với migration thứ hai, vì giao diện cũ nghe kênh chung đã bị bỏ nên chỉ còn đồng bộ dự phòng (chậm tới 15 giây) cho tới khi được thay.

Trong Supabase, **Realtime** phải được bật cho dự án. Không cần biến môi trường hay Edge Function mới.

**Thử bằng nhiều tài khoản:**
- Đăng nhập admin ở cửa sổ 1, seller ở cửa sổ 2 (ẩn danh), cashier ở cửa sổ 3.
- Seller thêm/sửa/xóa một đồ uống → admin thấy thông báo, seller (người làm) không thấy, **cashier không thấy**.
- Khách đặt hàng → cả ba thấy.
- Admin thêm nhân viên mới → cả ba thấy "A đã tham gia".

## 7. Gỡ lỗi

- **Xem WebSocket tận mắt:** mở DevTools (F12) → tab **Network** → lọc **WS**. Bạn sẽ thấy kết nối `.../realtime/v1/websocket`; bấm vào, tab **Messages** hiện từng tin đi và đến. Đây là cách học WebSocket nhanh nhất.
- **Chuông luôn báo "Đang kiểm tra định kỳ":** kênh WebSocket chưa nối được (thông báo đơn hàng vẫn đến nhưng chậm tới 15 giây). Mở Console (F12), tìm dòng bắt đầu bằng `Kênh thông báo nhân viên chưa kết nối` – nó ghi rõ lý do:
  - `CHANNEL_ERROR: Unauthorized: You do not have permissions to read from this Channel topic` → **chưa chạy migration**, hoặc vai trò của tài khoản trong bảng `profiles` không phải admin/seller/cashier.
  - `TIMED_OUT` → mạng chặn WebSocket (một số proxy, mạng công ty) hoặc Realtime của dự án chưa bật.
  - Không có dòng nào nhưng vẫn "định kỳ" → kiểm tra tab Network → WS xem có kết nối `.../realtime/v1/websocket` không.
- **Có thao tác nhưng không thông báo:** kiểm tra trigger có tồn tại không, ví dụ `select tgname from pg_trigger where tgname like 'trg_oncafe_broadcast%';` (phải thấy 5 trigger: order, 3 trigger menu, employee_joined), và xem log Postgres của Supabase có cảnh báo `Không gửi được thông báo ...` không.
- **Không nghe thấy âm báo:** trình duyệt thường chặn âm thanh cho đến khi người dùng bấm vào trang ít nhất một lần.

## 8. Bài tập tự luyện

Cấu trúc tách file giúp việc mở rộng rất rõ ràng. Gợi ý theo độ khó:

1. **Dễ – đổi âm báo hoặc thời gian hiện thông báo nổi:** sửa `NotificationSound.js` (tần số) hoặc hằng số `TOAST_DURATION_MS` trong `NotificationToasts.js`.
2. **Dễ – cho cashier cũng nhận thông báo đồ uống:** trong migration, đổi `array['admin', 'seller']` thành `array['admin', 'seller', 'cashier']` ở hàm `oncafe_broadcast_menu_event()` rồi chạy lại hàm đó. Giao diện không phải sửa gì.
3. **Vừa – thông báo khi khách hủy đơn:**
   - Migration: trong `oncafe_broadcast_order_event()` thêm nhánh `elsif new.status = 'cancelled' ...` với `v_type := 'cancelled'`.
   - `StaffNotification.js`: thêm loại `CANCELLED` và nội dung chữ.
   - `OrderChangeDetector.js`: thêm điều kiện cho đồng bộ dự phòng (không bắt buộc).
   - `StaffRealtimeRepo.js` **không cần sửa** nhờ nghe mọi sự kiện (`event: "*"`).
4. **Khó – thông báo khi hết hàng:** trigger trên cột `quantity` của `products` khi tồn kho về 0, gửi tới `['admin','seller']`; thêm loại `stock_empty` ở mô hình thông báo và một biểu tượng ở `NotificationAppearance.js`.
5. **Nâng cao – cho khách hàng nhận thông báo "đơn của bạn đã sẵn sàng":** cần kênh riêng theo từng khách (ví dụ `oncafe:customer:<id>`), luật RLS khác, và một bộ controller/view cho trang `my-orders`. Có thể dùng lại `StaffRealtimeRepo`, `NotificationStateRepo` và các view thông báo.

## 9. Giới hạn cần biết

- Thông báo chỉ hiện khi nhân viên **đang mở trang quản trị** (tab có thể ở nền). Không có thông báo khi đã đóng hẳn trình duyệt; muốn vậy cần Web Push, là một chức năng riêng.
- Thông báo **đồ uống** và **nhân viên mới** không được "bù" khi mất kết nối: sự kiện xảy ra lúc nhân viên offline sẽ không hiện sau đó. Đơn hàng thì được bù nhờ đồng bộ dự phòng.
- Lịch sử thông báo và các khóa "đã báo" lưu trong Local Storage của từng trình duyệt, nên thông báo ở máy này không đồng bộ sang máy khác.
- Nhân viên mới tham gia do Edge Function tạo nên không có thông tin người tạo bằng `actor` (rỗng); admin vừa thêm vẫn nhận thông báo như mọi người.
- Tính năng này được kiểm thử tự động bằng `python-tests/tests/test_staff_notifications.py` với client Supabase giả. Việc chạy với Supabase thật cần thử theo phần 6.
