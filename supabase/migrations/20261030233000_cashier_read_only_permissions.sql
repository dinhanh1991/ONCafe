-- Restrict operational order mutations to Admin and Seller.
-- Cashier may view orders and use cashier revenue reports, but cannot create orders,
-- change order status, confirm payments, or update delivery progress.

do $$
begin
  if to_regprocedure('public.oncafe_staff_create_order(text,text,text,text,jsonb)') is not null
     and to_regprocedure('public.oncafe_staff_create_order_internal(text,text,text,text,jsonb)') is null then
    alter function public.oncafe_staff_create_order(text,text,text,text,jsonb)
      rename to oncafe_staff_create_order_internal;
  end if;
  if to_regprocedure('public.oncafe_staff_update_order_status(bigint,text)') is not null
     and to_regprocedure('public.oncafe_staff_update_order_status_internal(bigint,text)') is null then
    alter function public.oncafe_staff_update_order_status(bigint,text)
      rename to oncafe_staff_update_order_status_internal;
  end if;
  if to_regprocedure('public.oncafe_staff_update_payment(bigint,text)') is not null
     and to_regprocedure('public.oncafe_staff_update_payment_internal(bigint,text)') is null then
    alter function public.oncafe_staff_update_payment(bigint,text)
      rename to oncafe_staff_update_payment_internal;
  end if;
  if to_regprocedure('public.oncafe_staff_mark_delivery_arrived(bigint)') is not null
     and to_regprocedure('public.oncafe_staff_mark_delivery_arrived_internal(bigint)') is null then
    alter function public.oncafe_staff_mark_delivery_arrived(bigint)
      rename to oncafe_staff_mark_delivery_arrived_internal;
  end if;
end;
$$;

create or replace function public.oncafe_staff_create_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_payment_method text,
  p_items jsonb
)
returns table(order_id bigint, order_code text, total_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(v_role, '') not in ('admin', 'seller') then
    raise exception 'Bạn không có quyền tạo đơn tại quầy.';
  end if;

  return query
  select *
  from public.oncafe_staff_create_order_internal(
    p_customer_name, p_customer_phone, p_customer_address, p_payment_method, p_items
  );
end;
$$;

create or replace function public.oncafe_staff_update_order_status(
  p_order_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(v_role, '') not in ('admin', 'seller') then
    raise exception 'Bạn không có quyền cập nhật đơn hàng.';
  end if;

  perform public.oncafe_staff_update_order_status_internal(p_order_id, p_status);
end;
$$;

create or replace function public.oncafe_staff_update_payment(
  p_order_id bigint,
  p_payment_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(v_role, '') not in ('admin', 'seller') then
    raise exception 'Bạn không có quyền cập nhật thanh toán.';
  end if;

  perform public.oncafe_staff_update_payment_internal(p_order_id, p_payment_status);
end;
$$;

create or replace function public.oncafe_staff_mark_delivery_arrived(
  p_order_id bigint
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(v_role, '') not in ('admin', 'seller') then
    raise exception 'Bạn không có quyền cập nhật thông tin giao hàng.';
  end if;

  return public.oncafe_staff_mark_delivery_arrived_internal(p_order_id);
end;
$$;

revoke all on function public.oncafe_staff_create_order_internal(text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.oncafe_staff_update_order_status_internal(bigint,text) from public, anon, authenticated;
revoke all on function public.oncafe_staff_update_payment_internal(bigint,text) from public, anon, authenticated;
revoke all on function public.oncafe_staff_mark_delivery_arrived_internal(bigint) from public, anon, authenticated;

revoke all on function public.oncafe_staff_create_order(text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.oncafe_staff_update_order_status(bigint,text) from public, anon, authenticated;
revoke all on function public.oncafe_staff_update_payment(bigint,text) from public, anon, authenticated;
revoke all on function public.oncafe_staff_mark_delivery_arrived(bigint) from public, anon, authenticated;

grant execute on function public.oncafe_staff_create_order(text,text,text,text,jsonb) to authenticated;
grant execute on function public.oncafe_staff_update_order_status(bigint,text) to authenticated;
grant execute on function public.oncafe_staff_update_payment(bigint,text) to authenticated;
grant execute on function public.oncafe_staff_mark_delivery_arrived(bigint) to authenticated;
