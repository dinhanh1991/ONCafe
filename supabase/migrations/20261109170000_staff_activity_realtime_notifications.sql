-- Broadcast thay đổi sản phẩm và thông báo tạo nhân viên.
-- Chỉ cấp quyền nghe kênh sản phẩm cho Admin/Seller; kênh nhân viên dùng chính sách staff-orders hiện có.

create or replace function public.oncafe_is_product_staff()
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
      and p.role in ('admin', 'seller')
  );
$$;

revoke all on function public.oncafe_is_product_staff() from public, anon;
grant execute on function public.oncafe_is_product_staff() to authenticated;

drop policy if exists "ONCafe product staff receive product notifications" on realtime.messages;
create policy "ONCafe product staff receive product notifications"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) = 'oncafe:staff-products'
  and realtime.messages.extension = 'broadcast'
  and (select public.oncafe_is_product_staff())
);

create or replace function public.oncafe_broadcast_product_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_type text;
begin
  if tg_op = 'DELETE' then
    v_row := old;
    v_type := 'product_deleted';
  elsif tg_op = 'INSERT' then
    v_row := new;
    v_type := 'product_created';
  else
    if old.name is not distinct from new.name
      and old.price is not distinct from new.price
      and old.quantity is not distinct from new.quantity
      and old.image_url is not distinct from new.image_url
      and old.is_available is not distinct from new.is_available
      and old.category_id is not distinct from new.category_id then
      return null;
    end if;
    v_row := new;
    v_type := 'product_updated';
  end if;

  begin
    perform realtime.send(
      jsonb_build_object(
        'type', v_type,
        'event_id', gen_random_uuid(),
        'at', now(),
        'actor', auth.uid(),
        'entity', jsonb_build_object(
          'id', v_row.id,
          'name', v_row.name,
          'quantity', v_row.quantity
        ),
        'changes_summary', case
          when tg_op = 'UPDATE' and old.quantity is distinct from new.quantity
            then 'Tồn kho: ' || coalesce(new.quantity::text, '0')
          else null
        end
      ),
      v_type,
      'oncafe:staff-products',
      true
    );
  exception when others then
    raise warning 'Không gửi được thông báo sản phẩm %: %', v_row.id, sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.oncafe_broadcast_product_event() from public, anon, authenticated;
drop trigger if exists trg_oncafe_broadcast_product_event on public.products;
create trigger trg_oncafe_broadcast_product_event
after insert or update or delete on public.products
for each row execute function public.oncafe_broadcast_product_event();

-- Hàm chỉ dành cho Edge Function đã xác thực Admin và đã tạo hồ sơ nhân viên thành công.
create or replace function public.oncafe_broadcast_employee_created(
  p_actor_id uuid,
  p_employee_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_employee record;
begin
  select p.role into v_actor_role
  from public.profiles p
  where p.id = p_actor_id;

  if v_actor_role is distinct from 'admin' then
    raise exception 'Only an admin may emit employee-created notifications.';
  end if;

  select p.id, p.full_name, p.role, u.email
  into v_employee
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_employee_id
    and p.role in ('admin', 'seller', 'cashier');

  if not found then
    raise exception 'Employee profile does not exist.';
  end if;

  perform realtime.send(
    jsonb_build_object(
      'type', 'employee_created',
      'event_id', gen_random_uuid(),
      'at', now(),
      'actor', p_actor_id,
      'entity', jsonb_build_object(
        'id', v_employee.id,
        'full_name', v_employee.full_name,
        'email', v_employee.email,
        'role', v_employee.role
      )
    ),
    'employee_created',
    'oncafe:staff-orders',
    true
  );
end;
$$;

revoke all on function public.oncafe_broadcast_employee_created(uuid, uuid) from public, anon, authenticated;
grant execute on function public.oncafe_broadcast_employee_created(uuid, uuid) to service_role;
