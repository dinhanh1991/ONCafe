-- Preserve customer contact details on each order instead of reading mutable profile data.
alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_address text;

-- Best-effort backfill for historical orders. Previously overwritten online details
-- cannot be reconstructed; use the customer record available at migration time.
update public.orders o
set customer_name = coalesce(nullif(o.customer_name, ''), nullif(o.counter_customer_name, ''), c.full_name),
    customer_phone = coalesce(nullif(o.customer_phone, ''), nullif(o.counter_customer_phone, ''), c.phone),
    customer_address = coalesce(nullif(o.customer_address, ''), nullif(o.counter_customer_address, ''), c.address)
from public.customers c
where o.customer_id = c.id
  and (o.customer_name is null or o.customer_phone is null or o.customer_address is null);

update public.orders o
set customer_name = coalesce(o.customer_name, o.counter_customer_name),
    customer_phone = coalesce(o.customer_phone, o.counter_customer_phone),
    customer_address = coalesce(o.customer_address, o.counter_customer_address)
where o.customer_name is null
   or o.customer_phone is null
   or o.customer_address is null;

create or replace function public.oncafe_create_order(
  p_full_name text, p_phone text, p_address text,
  p_payment_method text, p_fulfillment_method text, p_items jsonb
)
returns table(order_id bigint, order_code text, total_amount numeric)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_customer_id bigint;
  v_order_id bigint;
  v_order_code text;
  v_phone text;
  v_product_total numeric(12,2);
  v_delivery_fee numeric(12,2) := 0;
  v_total numeric(12,2);
  v_item_count integer;
  v_valid_count integer;
begin
  if v_user_id is null then raise exception 'Vui lòng đăng nhập trước khi đặt hàng.'; end if;
  select p.role into v_role from public.profiles p where p.id = v_user_id;
  if coalesce(v_role,'') <> 'customer' then raise exception 'Chỉ tài khoản khách hàng mới được đặt đơn online.'; end if;
  if nullif(trim(coalesce(p_full_name,'')), '') is null then raise exception 'Vui lòng nhập họ và tên.'; end if;

  v_phone := regexp_replace(trim(coalesce(p_phone,'')), '[[:space:]().-]', '', 'g');
  if left(v_phone, 3) = '+84' then v_phone := '0' || substr(v_phone, 4); end if;
  if v_phone !~ '^0[35789][0-9]{8}$' then raise exception 'Số điện thoại di động Việt Nam không hợp lệ.'; end if;
  if nullif(trim(coalesce(p_address,'')), '') is null then raise exception 'Vui lòng nhập địa chỉ.'; end if;
  if p_fulfillment_method = 'delivery' and length(trim(p_address)) < 20 then raise exception 'Địa chỉ giao hàng chưa đầy đủ.'; end if;
  if p_payment_method is distinct from 'qr' then raise exception 'Đơn hàng online bắt buộc thanh toán bằng QR.'; end if;
  if p_fulfillment_method is distinct from 'pickup' and p_fulfillment_method is distinct from 'delivery' then raise exception 'Hình thức nhận hàng không hợp lệ.'; end if;
  if p_fulfillment_method = 'delivery' then v_delivery_fee := 15000; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Giỏ hàng đang trống.'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) x(id bigint, quantity integer)
    where x.id is null or x.quantity is null or x.quantity < 1 or x.quantity > 99
  ) then raise exception 'Số lượng sản phẩm không hợp lệ.'; end if;

  select count(*) into v_item_count from jsonb_to_recordset(p_items) x(id bigint, quantity integer);
  if v_item_count <> (
    select count(distinct x.id) from jsonb_to_recordset(p_items) x(id bigint, quantity integer)
  ) then raise exception 'Giỏ hàng có sản phẩm bị trùng.'; end if;

  perform p.id
  from public.products p
  join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on x.id = p.id
  order by p.id for update of p;

  select count(*) into v_valid_count
  from public.products p
  join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on x.id = p.id
  where p.is_available = true and p.quantity >= x.quantity;
  if v_valid_count <> v_item_count then
    raise exception 'Có đồ uống ngừng bán, không tồn tại hoặc không đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.';
  end if;

  select coalesce(sum(p.price * x.quantity),0) into v_product_total
  from public.products p
  join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on x.id = p.id
  where p.is_available = true;
  v_total := v_product_total + v_delivery_fee;

  -- This remains the mutable current customer profile for checkout prefill.
  insert into public.customers(user_id, full_name, phone, email, address)
  values (
    v_user_id, trim(p_full_name), v_phone,
    (select u.email from auth.users u where u.id = v_user_id),
    trim(p_address)
  )
  on conflict (user_id) do update
  set full_name = excluded.full_name, phone = excluded.phone,
      email = excluded.email, address = excluded.address
  returning id into v_customer_id;

  v_order_code := 'ONC-' || to_char(now(),'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  -- Snapshot recipient details so later checkout changes cannot rewrite this order.
  insert into public.orders(
    customer_id, created_by, order_code, status, payment_method,
    payment_status, total_amount, stock_deducted, order_source,
    fulfillment_method, delivery_fee, customer_name, customer_phone, customer_address
  )
  values (
    v_customer_id, v_user_id, v_order_code, 'pending', 'qr',
    'unpaid', v_total, true, 'online', p_fulfillment_method, v_delivery_fee,
    trim(p_full_name), v_phone, trim(p_address)
  )
  returning id into v_order_id;

  insert into public.order_items(order_id, product_id, product_name, unit_price, quantity, subtotal)
  select v_order_id, p.id, p.name, p.price, x.quantity, p.price * x.quantity
  from public.products p
  join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on x.id = p.id;

  update public.products p
  set quantity = p.quantity - x.quantity
  from jsonb_to_recordset(p_items) x(id bigint, quantity integer)
  where p.id = x.id;

  return query select v_order_id, v_order_code, v_total;
end;
$function$;

create or replace function public.oncafe_my_orders()
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Vui lòng đăng nhập.'; end if;
  perform public.oncafe_process_expired_qr_orders();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id, 'order_code',o.order_code, 'status',o.status,
    'payment_method',o.payment_method, 'payment_status',o.payment_status,
    'total_amount',o.total_amount, 'delivery_fee',o.delivery_fee,
    'delivery_arrived_at',o.delivery_arrived_at, 'order_source',o.order_source,
    'fulfillment_method',o.fulfillment_method,
    'customer_name',coalesce(o.customer_name,c.full_name),
    'customer_phone',coalesce(o.customer_phone,c.phone),
    'customer_address',coalesce(o.customer_address,c.address),
    'created_at',o.created_at,
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name',i.product_name,'unit_price',i.unit_price,
        'quantity',i.quantity,'subtotal',i.subtotal
      ) order by i.id)
      from public.order_items i where i.order_id=o.id
    ),'[]'::jsonb)
  ) order by o.created_at desc),'[]'::jsonb)
  into v_result
  from public.orders o
  left join public.customers c on c.id=o.customer_id
  where o.created_by=v_user_id and o.order_source='online';
  return v_result;
end;
$function$;

create or replace function public.oncafe_staff_list_orders()
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_role text;
  v_result jsonb;
begin
  select p.role into v_role from public.profiles p where p.id = auth.uid();
  if coalesce(v_role, '') not in ('admin', 'cashier', 'seller') then
    raise exception 'Bạn không có quyền xem đơn hàng.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id, 'order_code', o.order_code, 'status', o.status,
      'payment_method', o.payment_method, 'payment_status', o.payment_status,
      'total_amount', o.total_amount, 'paid_at', o.paid_at,
      'delivery_arrived_at', o.delivery_arrived_at, 'created_at', o.created_at,
      'order_source', o.order_source, 'fulfillment_method', o.fulfillment_method,
      'delivery_fee', o.delivery_fee,
      'customer_name', coalesce(o.customer_name, o.counter_customer_name, c.full_name, 'Khách hàng'),
      'customer_phone', coalesce(o.customer_phone, o.counter_customer_phone, c.phone),
      'customer_address', coalesce(o.customer_address, o.counter_customer_address, c.address),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'product_name', oi.product_name, 'unit_price', oi.unit_price,
          'quantity', oi.quantity, 'subtotal', oi.subtotal
        ) order by oi.id)
        from public.order_items oi where oi.order_id = o.id
      ), '[]'::jsonb)
    ) order by o.created_at desc
  ), '[]'::jsonb)
  into v_result
  from public.orders o
  left join public.customers c on c.id = o.customer_id;
  return v_result;
end;
$function$;
