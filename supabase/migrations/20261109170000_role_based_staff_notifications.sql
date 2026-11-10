-- Thông báo cho nhân viên theo vai trò (Supabase Realtime, WebSocket).
--
-- Mỗi vai trò nghe MỘT kênh riêng của vai trò đó: "oncafe:role:admin", "oncafe:role:seller",
-- "oncafe:role:cashier". Cơ sở dữ liệu quyết định vai trò nào nhận loại thông báo nào:
--   * Đơn hàng mới / đơn hoàn tất ........ admin, seller, cashier
--   * Thêm / sửa / xóa đồ uống ............ admin, seller            (cashier không nhận)
--   * Nhân viên mới tham gia .............. admin, seller, cashier
-- Muốn đổi người nhận chỉ cần sửa mảng vai trò ở các hàm trigger bên dưới.
-- Thay thế kênh chung "oncafe:staff-orders" của migration 20261109110000.

-- Vai trò nhân viên của tài khoản hiện tại; null nếu không phải nhân viên.
create or replace function public.oncafe_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.role in ('admin', 'seller', 'cashier');
$$;

revoke all on function public.oncafe_staff_role() from public, anon;
grant execute on function public.oncafe_staff_role() to authenticated;

-- Mỗi nhân viên chỉ được nghe kênh của đúng vai trò mình. Không cấp quyền ghi cho client.
drop policy if exists "ONCafe staff receive order notifications" on realtime.messages;
drop policy if exists "ONCafe staff receive role notifications" on realtime.messages;
create policy "ONCafe staff receive role notifications"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) = 'oncafe:role:' || (select public.oncafe_staff_role())
);

drop function if exists public.oncafe_is_staff();

-- Thông tin người thực hiện thao tác (null khi do hệ thống, Edge Function hoặc SQL Editor thực hiện).
create or replace function public.oncafe_notification_actor()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('actor', u.uid, 'actor_name', p.full_name, 'actor_role', p.role)
  from (select auth.uid() as uid) u
  left join public.profiles p on p.id = u.uid;
$$;

revoke all on function public.oncafe_notification_actor() from public, anon, authenticated;

-- Gửi một sự kiện đến kênh của từng vai trò trong danh sách. Lỗi gửi không bao giờ làm hỏng nghiệp vụ.
create or replace function public.oncafe_broadcast_to_roles(p_roles text[], p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  foreach v_role in array p_roles loop
    begin
      perform realtime.send(p_payload, p_event, 'oncafe:role:' || v_role, true);
    exception when others then
      raise warning 'Không gửi được thông báo % đến vai trò %: %', p_event, v_role, sqlerrm;
    end;
  end loop;
end;
$$;

revoke all on function public.oncafe_broadcast_to_roles(text[], text, jsonb) from public, anon, authenticated;

-- 1) Đơn hàng: đơn mới và đơn chuyển sang "completed" -> admin, seller, cashier.
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
    perform public.oncafe_broadcast_to_roles(
      array['admin', 'seller', 'cashier'],
      'order_' || v_type,
      jsonb_build_object(
        'type', v_type,
        'order', jsonb_build_object(
          'id', new.id,
          'order_code', new.order_code,
          'status', new.status,
          'order_source', new.order_source,
          'fulfillment_method', new.fulfillment_method,
          'total_amount', new.total_amount,
          'customer_name', coalesce(new.customer_name, new.counter_customer_name, 'Khách hàng')
        )
      ) || public.oncafe_notification_actor()
    );
  exception when others then
    raise warning 'Không gửi được thông báo đơn hàng %: %', new.id, sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.oncafe_broadcast_order_event() from public, anon, authenticated;

-- 2) Đồ uống: thêm, sửa (tên, giá, mô tả, ảnh, danh mục, trạng thái bán) và xóa -> admin, seller.
-- Thay đổi tồn kho (quantity) không tính là "sửa đồ uống" vì mỗi đơn hàng đều trừ/cộng tồn kho.
create or replace function public.oncafe_broadcast_menu_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_id bigint;
  v_name text;
  v_changed text[] := array[]::text[];
begin
  begin
    if tg_op = 'INSERT' then
      v_type := 'menu_created';
      v_id := new.id;
      v_name := new.name;
    elsif tg_op = 'DELETE' then
      v_type := 'menu_deleted';
      v_id := old.id;
      v_name := old.name;
    else
      v_type := 'menu_updated';
      v_id := new.id;
      v_name := new.name;
      if new.name is distinct from old.name then v_changed := array_append(v_changed, 'name'); end if;
      if new.price is distinct from old.price then v_changed := array_append(v_changed, 'price'); end if;
      if new.description is distinct from old.description then v_changed := array_append(v_changed, 'description'); end if;
      if new.image_url is distinct from old.image_url then v_changed := array_append(v_changed, 'image'); end if;
      if new.category_id is distinct from old.category_id then v_changed := array_append(v_changed, 'category'); end if;
      if new.is_available is distinct from old.is_available then v_changed := array_append(v_changed, 'status'); end if;
      if cardinality(v_changed) = 0 then
        return null;
      end if;
    end if;

    perform public.oncafe_broadcast_to_roles(
      array['admin', 'seller'],
      v_type,
      jsonb_build_object(
        'type', v_type,
        'event_id', gen_random_uuid(),
        'product', jsonb_build_object('id', v_id, 'name', v_name),
        'changed', to_jsonb(v_changed)
      ) || public.oncafe_notification_actor()
    );
  exception when others then
    raise warning 'Không gửi được thông báo đồ uống: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.oncafe_broadcast_menu_event() from public, anon, authenticated;

drop trigger if exists trg_oncafe_broadcast_menu_insert on public.products;
create trigger trg_oncafe_broadcast_menu_insert
after insert on public.products
for each row execute function public.oncafe_broadcast_menu_event();

drop trigger if exists trg_oncafe_broadcast_menu_update on public.products;
create trigger trg_oncafe_broadcast_menu_update
after update of name, price, description, image_url, category_id, is_available on public.products
for each row execute function public.oncafe_broadcast_menu_event();

drop trigger if exists trg_oncafe_broadcast_menu_delete on public.products;
create trigger trg_oncafe_broadcast_menu_delete
after delete on public.products
for each row execute function public.oncafe_broadcast_menu_event();

-- 3) Nhân viên mới tham gia (chỉ thêm, không báo khi sửa hay xóa) -> admin, seller, cashier.
-- Edge Function admin-manage-employees tạo tài khoản (hồ sơ ban đầu có vai trò customer) rồi nâng lên
-- vai trò nhân viên, nên trigger bắt cả INSERT lẫn UPDATE vai trò từ không phải nhân viên -> nhân viên.
-- Đổi vai trò giữa các nhân viên (ví dụ seller -> cashier) không được tính là tham gia.
create or replace function public.oncafe_broadcast_employee_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff constant text[] := array['admin', 'seller', 'cashier'];
begin
  begin
    if new.role = any (v_staff)
       and (tg_op = 'INSERT' or old.role is null or not (old.role = any (v_staff))) then
      perform public.oncafe_broadcast_to_roles(
        v_staff,
        'employee_joined',
        jsonb_build_object(
          'type', 'employee_joined',
          'event_id', gen_random_uuid(),
          'employee', jsonb_build_object(
            'id', new.id,
            'full_name', coalesce(nullif(trim(new.full_name), ''), 'Nhân viên mới'),
            'role', new.role
          )
        ) || public.oncafe_notification_actor()
      );
    end if;
  exception when others then
    raise warning 'Không gửi được thông báo nhân viên mới: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.oncafe_broadcast_employee_joined() from public, anon, authenticated;

drop trigger if exists trg_oncafe_broadcast_employee_joined on public.profiles;
create trigger trg_oncafe_broadcast_employee_joined
after insert or update of role on public.profiles
for each row execute function public.oncafe_broadcast_employee_joined();
