-- ONCafe staff order management: server-side role checks and controlled status transitions.
-- Run after 20261029_customer_checkout.sql and 20261029_checkout_stock_safety.sql.

create or replace function public.oncafe_staff_list_orders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text;
    v_result jsonb;
begin
    select p.role into v_role
    from public.profiles p
    where p.id = auth.uid();

    if v_role not in ('admin', 'cashier') then
        raise exception 'Bạn không có quyền xem danh sách đơn hàng.';
    end if;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', o.id,
            'order_code', o.order_code,
            'status', o.status,
            'payment_method', o.payment_method,
            'payment_status', o.payment_status,
            'total_amount', o.total_amount,
            'created_at', o.created_at,
            'customer_name', c.full_name,
            'customer_phone', c.phone,
            'customer_address', c.address,
            'items', coalesce((
                select jsonb_agg(jsonb_build_object(
                    'product_name', oi.product_name,
                    'unit_price', oi.unit_price,
                    'quantity', oi.quantity,
                    'subtotal', oi.subtotal
                ) order by oi.id)
                from public.order_items oi
                where oi.order_id = o.id
            ), '[]'::jsonb)
        ) order by o.created_at desc
    ), '[]'::jsonb)
    into v_result
    from public.orders o
    left join public.customers c on c.id = o.customer_id;

    return v_result;
end;
$$;

create or replace function public.oncafe_staff_update_order_status(
    p_order_id bigint,
    p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text;
    v_current_status text;
begin
    select p.role into v_role
    from public.profiles p
    where p.id = auth.uid();

    if v_role not in ('admin', 'cashier') then
        raise exception 'Bạn không có quyền cập nhật đơn hàng.';
    end if;

    if p_status not in ('confirmed', 'preparing', 'delivering', 'completed', 'rejected') then
        raise exception 'Trạng thái đơn hàng không hợp lệ.';
    end if;

    select o.status into v_current_status
    from public.orders o
    where o.id = p_order_id
    for update;

    if not found then
        raise exception 'Không tìm thấy đơn hàng.';
    end if;

    if v_current_status in ('completed', 'cancelled', 'rejected') then
        raise exception 'Đơn hàng đã kết thúc, không thể thay đổi trạng thái.';
    end if;

    if p_status = 'confirmed' and v_current_status <> 'pending' then
        raise exception 'Chỉ xác nhận được đơn đang chờ xử lý.';
    end if;

    if p_status = 'preparing' and v_current_status not in ('confirmed', 'pending') then
        raise exception 'Chỉ chuyển sang pha chế khi đơn đang chờ hoặc đã xác nhận.';
    end if;

    if p_status = 'delivering' and v_current_status not in ('confirmed', 'preparing') then
        raise exception 'Chỉ chuyển sang giao hàng sau khi xác nhận hoặc pha chế.';
    end if;

    if p_status = 'completed' and v_current_status not in ('preparing', 'delivering', 'confirmed') then
        raise exception 'Đơn hàng chưa sẵn sàng để hoàn tất.';
    end if;

    if p_status = 'rejected' and v_current_status <> 'pending' then
        raise exception 'Chỉ từ chối được đơn đang chờ xử lý.';
    end if;

    update public.orders
    set status = p_status
    where id = p_order_id;
end;
$$;

revoke all on function public.oncafe_staff_list_orders() from public;
revoke all on function public.oncafe_staff_update_order_status(bigint, text) from public;
grant execute on function public.oncafe_staff_list_orders() to authenticated;
grant execute on function public.oncafe_staff_update_order_status(bigint, text) to authenticated;
