-- Thông báo đơn hàng theo thời gian thực cho nhân viên (Supabase Realtime, giao thức WebSocket).
--
-- Khi có đơn mới hoặc đơn chuyển sang "completed", trigger gửi một broadcast đến kênh riêng
-- "oncafe:staff-orders". Chỉ tài khoản admin/seller/cashier được nhận (chính sách RLS trên
-- realtime.messages). Trigger đứng trên bảng orders nên bắt được mọi nguồn thay đổi: khách đặt hàng,
-- nhân viên lập đơn tại quầy, cập nhật trạng thái và tác vụ tự hoàn tất đơn giao hàng.

-- Kiểm tra tài khoản hiện tại có phải nhân viên hay không (dùng trong chính sách RLS).
create or replace function public.oncafe_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'seller', 'cashier')
  );
$$;

revoke all on function public.oncafe_is_staff() from public, anon;
grant execute on function public.oncafe_is_staff() to authenticated;

-- Chỉ nhân viên được nghe kênh thông báo đơn hàng. Không cấp quyền ghi (insert) cho client:
-- chỉ trigger phía máy chủ mới phát được sự kiện.
drop policy if exists "ONCafe staff receive order notifications" on realtime.messages;
create policy "ONCafe staff receive order notifications"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) = 'oncafe:staff-orders'
  and realtime.messages.extension = 'broadcast'
  and (select public.oncafe_is_staff())
);

-- Gửi sự kiện đơn hàng. Lỗi gửi thông báo không bao giờ được làm hỏng nghiệp vụ đặt hàng.
create or replace function public.oncafe_broadcast_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if tg_op = 'INSERT' then
    v_type := 'new';
  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    v_type := 'completed';
  else
    return null;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object(
        'type', v_type,
        -- Người thực hiện thao tác; giao diện dùng để không tự báo cho chính người đó.
        'actor', auth.uid(),
        'order', jsonb_build_object(
          'id', new.id,
          'order_code', new.order_code,
          'status', new.status,
          'order_source', new.order_source,
          'fulfillment_method', new.fulfillment_method,
          'total_amount', new.total_amount,
          'customer_name', coalesce(new.customer_name, new.counter_customer_name, 'Khách hàng')
        )
      ),
      'order_' || v_type,
      'oncafe:staff-orders',
      true
    );
  exception when others then
    raise warning 'Không gửi được thông báo đơn hàng %: %', new.id, sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.oncafe_broadcast_order_event() from public, anon, authenticated;

drop trigger if exists trg_oncafe_broadcast_order_event on public.orders;
create trigger trg_oncafe_broadcast_order_event
after insert or update of status on public.orders
for each row execute function public.oncafe_broadcast_order_event();
