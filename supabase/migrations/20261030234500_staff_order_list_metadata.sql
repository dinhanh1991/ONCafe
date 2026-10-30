-- Return fulfillment metadata required by the staff order table and its filters.
create or replace function public.oncafe_staff_list_orders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_role text;
    v_result jsonb;
begin
    select p.role into v_role
    from public.profiles p
    where p.id = auth.uid();

    if coalesce(v_role, '') not in ('admin', 'cashier', 'seller') then
        raise exception 'Bạn không có quyền xem đơn hàng.';
    end if;

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', o.id,
            'order_code', o.order_code,
            'status', o.status,
            'payment_method', o.payment_method,
            'payment_status', o.payment_status,
            'total_amount', o.total_amount,
            'paid_at', o.paid_at,
            'created_at', o.created_at,
            'order_source', o.order_source,
            'fulfillment_method', o.fulfillment_method,
            'delivery_fee', o.delivery_fee,
            'customer_name', coalesce(o.counter_customer_name, c.full_name, 'Khách hàng'),
            'customer_phone', coalesce(o.counter_customer_phone, c.phone),
            'customer_address', coalesce(o.counter_customer_address, c.address),
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

revoke all on function public.oncafe_staff_list_orders() from public, anon;
grant execute on function public.oncafe_staff_list_orders() to authenticated;
