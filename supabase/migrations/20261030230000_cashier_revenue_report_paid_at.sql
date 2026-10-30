alter table public.orders
    add column if not exists paid_at timestamptz;

-- Historical paid/refunded orders predate paid_at; use created_at as agreed.
update public.orders
set paid_at = created_at
where payment_status in ('paid', 'refunded')
  and paid_at is null;

create or replace function public.oncafe_staff_update_payment(p_order_id bigint, p_payment_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text;
  v_order public.orders%rowtype;
begin
  select p.role into v_role from public.profiles p where p.id = auth.uid();
  if coalesce(v_role, '') not in ('admin', 'cashier', 'seller') then
    raise exception 'Bạn không có quyền cập nhật thanh toán.';
  end if;
  if p_payment_status <> 'paid' then
    raise exception 'Không thể hoàn tác trạng thái thanh toán bằng chức năng này.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng.'; end if;
  if v_order.status in ('cancelled', 'rejected') then raise exception 'Đơn hàng đã kết thúc.'; end if;
  if v_order.payment_method = 'qr' then
    raise exception 'Thanh toán QR chỉ được xác nhận bằng liên kết QR hợp lệ.';
  end if;
  if v_order.payment_status = 'paid' then return; end if;

  update public.orders
     set payment_status = 'paid',
         paid_at = now()
   where id = p_order_id;
end;
$function$;

create or replace function public.oncafe_public_confirm_qr_payment(p_token_hash text)
returns table(order_code text, total_amount numeric)
language plpgsql
set search_path to ''
as $function$
declare
    v_order_id bigint;
    v_order_code text;
    v_total_amount numeric;
begin
    if p_token_hash is null or length(p_token_hash) <> 64 then
        return;
    end if;

    select t.order_id
      into v_order_id
      from public.order_payment_tokens as t
     where t.token_hash = p_token_hash
       and t.used_at is null
       and t.expires_at > now()
     for update;

    if v_order_id is null then
        return;
    end if;

    update public.orders as o
       set payment_status = 'paid',
           paid_at = now()
     where o.id = v_order_id
       and o.payment_method = 'qr'
       and o.payment_status = 'unpaid'
       and o.status not in ('cancelled', 'rejected')
     returning o.order_code, o.total_amount
          into v_order_code, v_total_amount;

    if not found then
        return;
    end if;

    update public.order_payment_tokens
       set used_at = now()
     where order_id = v_order_id
       and used_at is null;

    return query select v_order_code, v_total_amount;
end;
$function$;

create or replace function public.oncafe_cashier_revenue_report(
    p_period text,
    p_anchor_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_role text;
    v_start_date date;
    v_end_date date;
    v_bucket_unit text;
    v_result jsonb;
begin
    select p.role into v_role
      from public.profiles p
     where p.id = auth.uid();

    if coalesce(v_role, '') not in ('admin', 'cashier') then
        raise exception 'Bạn không có quyền xem báo cáo doanh thu.';
    end if;
    if p_anchor_date is null then
        raise exception 'Vui lòng chọn ngày báo cáo.';
    end if;

    if p_period = 'day' then
        v_start_date := p_anchor_date;
        v_end_date := p_anchor_date + 1;
        v_bucket_unit := 'hour';
    elsif p_period = 'month' then
        v_start_date := date_trunc('month', p_anchor_date::timestamp)::date;
        v_end_date := (v_start_date + interval '1 month')::date;
        v_bucket_unit := 'day';
    elsif p_period = 'year' then
        v_start_date := date_trunc('year', p_anchor_date::timestamp)::date;
        v_end_date := (v_start_date + interval '1 year')::date;
        v_bucket_unit := 'month';
    else
        raise exception 'Loại báo cáo không hợp lệ.';
    end if;

    with scoped_orders as (
        select
            o.total_amount,
            o.payment_status,
            date_trunc(
                v_bucket_unit,
                coalesce(o.paid_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh'
            ) as bucket_start
        from public.orders o
        where o.payment_status in ('paid', 'refunded')
          and coalesce(o.paid_at, o.created_at) >=
              (v_start_date::timestamp at time zone 'Asia/Ho_Chi_Minh')
          and coalesce(o.paid_at, o.created_at) <
              (v_end_date::timestamp at time zone 'Asia/Ho_Chi_Minh')
    ),
    summary as (
        select
            coalesce(sum(total_amount) filter (where payment_status = 'paid'), 0) as paid_amount,
            coalesce(sum(total_amount) filter (where payment_status = 'refunded'), 0) as refunded_amount,
            count(*) filter (where payment_status = 'paid') as paid_orders,
            count(*) filter (where payment_status = 'refunded') as refunded_orders
        from scoped_orders
    ),
    bucket_totals as (
        select
            bucket_start,
            coalesce(sum(total_amount) filter (where payment_status = 'paid'), 0) as paid_amount,
            coalesce(sum(total_amount) filter (where payment_status = 'refunded'), 0) as refunded_amount,
            count(*) filter (where payment_status = 'paid') as paid_orders,
            count(*) filter (where payment_status = 'refunded') as refunded_orders
        from scoped_orders
        group by bucket_start
    )
    select jsonb_build_object(
        'period', p_period,
        'start_date', v_start_date,
        'end_date', v_end_date,
        'summary', jsonb_build_object(
            'paid_amount', s.paid_amount,
            'refunded_amount', s.refunded_amount,
            'net_revenue', s.paid_amount - s.refunded_amount,
            'paid_orders', s.paid_orders,
            'refunded_orders', s.refunded_orders
        ),
        'buckets', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'label',
                    case
                        when p_period = 'day' then to_char(b.bucket_start, 'HH24:00')
                        when p_period = 'month' then to_char(b.bucket_start, 'DD/MM')
                        else to_char(b.bucket_start, 'MM/YYYY')
                    end,
                    'paid_amount', b.paid_amount,
                    'refunded_amount', b.refunded_amount,
                    'net_revenue', b.paid_amount - b.refunded_amount,
                    'paid_orders', b.paid_orders,
                    'refunded_orders', b.refunded_orders
                )
                order by b.bucket_start
            )
            from bucket_totals b
        ), '[]'::jsonb)
    )
    into v_result
    from summary s;

    return v_result;
end;
$function$;

revoke all on function public.oncafe_cashier_revenue_report(text, date) from public;
revoke all on function public.oncafe_cashier_revenue_report(text, date) from anon;
grant execute on function public.oncafe_cashier_revenue_report(text, date) to authenticated;
