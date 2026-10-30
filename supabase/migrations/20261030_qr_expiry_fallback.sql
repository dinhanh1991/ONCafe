-- Keep a fallback QR expiry timestamp even if QR image/token generation is temporarily unavailable.
alter table public.orders
  add column if not exists qr_expires_at timestamptz;

create or replace function public.oncafe_set_qr_order_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_method='qr' and new.payment_status='unpaid'
     and new.qr_expires_at is null then
    new.qr_expires_at := now() + interval '15 minutes';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_oncafe_set_qr_order_expiry on public.orders;
create trigger trg_oncafe_set_qr_order_expiry
before insert on public.orders
for each row execute function public.oncafe_set_qr_order_expiry();

create or replace function public.oncafe_process_expired_qr_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_processed integer := 0;
begin
  for v_order in
    select o.id, o.stock_deducted
    from public.orders o
    left join public.order_payment_tokens t on t.order_id = o.id
    where o.payment_method = 'qr'
      and o.payment_status = 'unpaid'
      and o.status = 'pending'
      and t.used_at is null
      and coalesce(t.expires_at, o.qr_expires_at) <= now()
    order by coalesce(t.expires_at, o.qr_expires_at)
    for update of o skip locked
  loop
    if coalesce(v_order.stock_deducted, false) then
      update public.products p
      set quantity = p.quantity + reserved.quantity
      from (
        select oi.product_id, sum(oi.quantity)::integer as quantity
        from public.order_items oi
        where oi.order_id = v_order.id and oi.product_id is not null
        group by oi.product_id
      ) reserved
      where p.id = reserved.product_id;
    end if;

    update public.orders
    set status = 'cancelled', stock_deducted = false
    where id = v_order.id;

    update public.order_payment_tokens
    set used_at = coalesce(used_at, now())
    where order_id = v_order.id;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

revoke all on function public.oncafe_process_expired_qr_orders() from public, anon, authenticated;
