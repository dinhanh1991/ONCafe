-- ONCafe: enforce stock availability and decrement inventory atomically during checkout.
-- Run after 20261029_customer_checkout.sql. A failed order rolls back stock changes too.

create or replace function public.oncafe_create_order(
    p_full_name text,
    p_phone text,
    p_address text,
    p_payment_method text,
    p_items jsonb
)
returns table(order_id bigint, order_code text, total_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_customer_id bigint;
    v_order_id bigint;
    v_order_code text;
    v_total numeric(12,2);
    v_item_count integer;
    v_locked_count integer;
begin
    if v_user_id is null then
        raise exception 'Vui lòng đăng nhập trước khi đặt hàng.';
    end if;

    if nullif(trim(p_full_name), '') is null then
        raise exception 'Vui lòng nhập họ và tên.';
    end if;

    if nullif(trim(p_phone), '') is null then
        raise exception 'Vui lòng nhập số điện thoại.';
    end if;

    if p_payment_method not in ('cash', 'qr') then
        raise exception 'Phương thức thanh toán không hợp lệ.';
    end if;

    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Giỏ hàng đang trống.';
    end if;

    if exists (
        select 1
        from jsonb_to_recordset(p_items) as x(id bigint, quantity integer)
        where x.id is null or x.quantity is null or x.quantity < 1 or x.quantity > 99
    ) then
        raise exception 'Số lượng sản phẩm không hợp lệ.';
    end if;

    select count(*) into v_item_count
    from jsonb_to_recordset(p_items) as x(id bigint, quantity integer);

    if v_item_count <> (
        select count(distinct x.id)
        from jsonb_to_recordset(p_items) as x(id bigint, quantity integer)
    ) then
        raise exception 'Giỏ hàng có sản phẩm bị trùng.';
    end if;

    -- Lock requested product rows in a stable order to prevent overselling.
    perform p.id
    from public.products p
    join jsonb_to_recordset(p_items) as x(id bigint, quantity integer) on x.id = p.id
    order by p.id
    for update of p;

    select count(*) into v_locked_count
    from public.products p
    join jsonb_to_recordset(p_items) as x(id bigint, quantity integer) on x.id = p.id
    where p.is_available = true
      and p.quantity >= x.quantity;

    if v_locked_count <> v_item_count then
        raise exception 'Có sản phẩm đã ngừng bán, không tồn tại hoặc không đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.';
    end if;

    -- Recalculate the order total using database prices, never browser-supplied prices.
    select coalesce(sum(p.price * x.quantity), 0)
      into v_total
    from jsonb_to_recordset(p_items) as x(id bigint, quantity integer)
    join public.products p on p.id = x.id
    where p.is_available = true;

    insert into public.customers (user_id, full_name, phone, email, address)
    values (
        v_user_id,
        trim(p_full_name),
        trim(p_phone),
        (select email from auth.users where id = v_user_id),
        nullif(trim(coalesce(p_address, '')), '')
    )
    on conflict (user_id) do update set
        full_name = excluded.full_name,
        phone = excluded.phone,
        email = excluded.email,
        address = excluded.address
    returning id into v_customer_id;

    v_order_code := 'ONC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    insert into public.orders (
        customer_id, created_by, order_code, status, payment_method,
        payment_status, total_amount
    )
    values (
        v_customer_id, v_user_id, v_order_code, 'pending',
        p_payment_method, 'unpaid', v_total
    )
    returning id into v_order_id;

    insert into public.order_items (
        order_id, product_id, product_name, unit_price, quantity, subtotal
    )
    select
        v_order_id, p.id, p.name, p.price, x.quantity, p.price * x.quantity
    from jsonb_to_recordset(p_items) as x(id bigint, quantity integer)
    join public.products p on p.id = x.id
    where p.is_available = true;

    -- The row locks are still held. Subtract requested quantities within this transaction.
    update public.products p
    set quantity = p.quantity - x.quantity
    from jsonb_to_recordset(p_items) as x(id bigint, quantity integer)
    where p.id = x.id;

    return query select v_order_id, v_order_code, v_total;
end;
$$;

revoke all on function public.oncafe_create_order(text, text, text, text, jsonb) from public;
grant execute on function public.oncafe_create_order(text, text, text, text, jsonb) to authenticated;
