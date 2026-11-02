-- ONCafe: securely create an order from the signed-in customer's cart.
-- Run this file in Supabase SQL Editor before testing checkout.

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

    if p_payment_method not in ('cash', 'qr', 'card') then
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

    if v_item_count <> (select count(distinct x.id) from jsonb_to_recordset(p_items) as x(id bigint, quantity integer)) then
        raise exception 'Giỏ hàng có sản phẩm bị trùng.';
    end if;

    -- Calculate the total from current database prices, never from browser-supplied prices.
    select coalesce(sum(p.price * x.quantity), 0)
      into v_total
    from jsonb_to_recordset(p_items) as x(id bigint, quantity integer)
    join public.products p on p.id = x.id
    where p.is_available = true;

    if (
        select count(*)
        from jsonb_to_recordset(p_items) as x(id bigint, quantity integer)
        join public.products p on p.id = x.id
        where p.is_available = true
    ) <> v_item_count then
        raise exception 'Một hoặc nhiều sản phẩm không còn được mở bán. Vui lòng tải lại thực đơn.';
    end if;

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

    return query select v_order_id, v_order_code, v_total;
end;
$$;

revoke all on function public.oncafe_create_order(text, text, text, text, jsonb) from public;
grant execute on function public.oncafe_create_order(text, text, text, text, jsonb) to authenticated;

-- Customers can only read their own orders and the items belonging to those orders.
drop policy if exists "Customers view own orders" on public.orders;
create policy "Customers view own orders"
on public.orders for select to authenticated
using (created_by = auth.uid());

drop policy if exists "Customers view own order items" on public.order_items;
create policy "Customers view own order items"
on public.order_items for select to authenticated
using (
    exists (
        select 1 from public.orders o
        where o.id = order_items.order_id and o.created_by = auth.uid()
    )
);

drop policy if exists "Customers view own customer record" on public.customers;
create policy "Customers view own customer record"
on public.customers for select to authenticated
using (user_id = auth.uid());
