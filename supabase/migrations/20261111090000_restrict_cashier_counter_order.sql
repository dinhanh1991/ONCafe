-- Keep counter-order creation restricted to Admin and Seller.
-- This restores the role-checking wrapper after the counter cash/payment migration.

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
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    p_payment_method,
    p_items
  );
end;
$$;

revoke all on function public.oncafe_staff_create_order(text,text,text,text,jsonb)
  from public, anon, authenticated;

grant execute on function public.oncafe_staff_create_order(text,text,text,text,jsonb)
  to authenticated;
