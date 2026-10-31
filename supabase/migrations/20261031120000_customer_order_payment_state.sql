-- Return only the payment state for one online order owned by the current customer.

create or replace function public.oncafe_my_order_payment_state(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Vui lòng đăng nhập.';
  end if;

  -- Apply the same expiry rules used by the customer order-history endpoint.
  perform public.oncafe_process_expired_qr_orders();

  select jsonb_build_object(
    'id', o.id,
    'order_code', o.order_code,
    'status', o.status,
    'payment_status', o.payment_status,
    'total_amount', o.total_amount
  )
  into v_result
  from public.orders o
  where o.id = p_order_id
    and o.created_by = v_user_id
    and o.order_source = 'online';

  return v_result;
end;
$function$;

revoke all on function public.oncafe_my_order_payment_state(bigint) from public, anon, authenticated;
grant execute on function public.oncafe_my_order_payment_state(bigint) to authenticated;
