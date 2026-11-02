-- Keep the repository migration history aligned with the live Supabase project.
-- Online delivery is QR-prepaid and staff can record arrival at the delivery address.

alter table public.orders
  add column if not exists delivery_arrived_at timestamptz;

create or replace function public.oncafe_create_order(
  p_full_name text,
  p_phone text,
  p_address text,
  p_payment_method text,
  p_fulfillment_method text,
  p_items jsonb
)
returns table(order_id bigint, order_code text, total_amount numeric)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_phone text;
  v_customer_id bigint;
  v_order_id bigint;
  v_order_code text;
  v_product_total numeric(12,2);
  v_delivery_fee numeric(12,2) := 0;
  v_total numeric(12,2);
  v_item_count integer;
  v_valid_count integer;
begin
  if v_user_id is null then
    raise exception 'Vui lòng đăng nhập trước khi đặt hàng.';
  end if;

  select p.role into v_role from public.profiles p where p.id = v_user_id;
  if coalesce(v_role,'') <> 'customer' then
    raise exception 'Chỉ tài khoản khách hàng mới được đặt đơn online.';
  end if;

  if nullif(trim(coalesce(p_full_name,'')), '') is null then
    raise exception 'Vui lòng nhập họ và tên.';
  end if;

  v_phone := regexp_replace(trim(coalesce(p_phone,'')), '[ .()-]', '', 'g');
  if v_phone !~ '^(0([35789][0-9]{8}|2[0-9]{8,9})|\+84([35789][0-9]{8}|2[0-9]{8,9}))$' then
    raise exception 'Số điện thoại chưa hợp lệ. Vui lòng nhập số điện thoại Việt Nam đúng định dạng.';
  end if;

  if p_payment_method not in ('cash','qr') then
    raise exception 'Phương thức thanh toán không hợp lệ.';
  end if;
  if p_fulfillment_method not in ('pickup','delivery') then
    raise exception 'Hình thức nhận hàng không hợp lệ.';
  end if;

  if p_fulfillment_method = 'delivery' then
    if p_payment_method <> 'qr' then
      raise exception 'Đơn giao tận nhà bắt buộc thanh toán chuyển khoản QR trước.';
    end if;
    if length(trim(coalesce(p_address,''))) < 20 then
      raise exception 'Địa chỉ giao hàng chưa đầy đủ. Vui lòng nhập số nhà/đường hoặc thôn xóm, phường/xã, quận/huyện và tỉnh/thành phố.';
    end if;
    v_delivery_fee := 15000;
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng đang trống.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) x(id bigint, quantity integer)
    where x.id is null or x.quantity is null or x.quantity < 1 or x.quantity > 99
  ) then
    raise exception 'Số lượng sản phẩm không hợp lệ.';
  end if;

  select count(*) into v_item_count
  from jsonb_to_recordset(p_items) x(id bigint, quantity integer);
  if v_item_count <> (
    select count(distinct x.id)
    from jsonb_to_recordset(p_items) x(id bigint, quantity integer)
  ) then
    raise exception 'Giỏ hàng có sản phẩm bị trùng.';
  end if;

  perform p.id
  from public.products p
  join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on x.id = p.id
  order by p.id
  for update of p;

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

  insert into public.customers(user_id, full_name, phone, email, address)
  values (
    v_user_id, trim(p_full_name), v_phone,
    (select u.email from auth.users u where u.id = v_user_id),
    nullif(trim(coalesce(p_address,'')), '')
  )
  on conflict (user_id) do update
  set full_name = excluded.full_name,
      phone = excluded.phone,
      email = excluded.email,
      address = excluded.address
  returning id into v_customer_id;

  v_order_code := 'ONC-' || to_char(now(),'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.orders(
    customer_id, created_by, order_code, status, payment_method,
    payment_status, total_amount, stock_deducted, order_source,
    fulfillment_method, delivery_fee
  )
  values (
    v_customer_id, v_user_id, v_order_code, 'pending', p_payment_method,
    'unpaid', v_total, true, 'online', p_fulfillment_method, v_delivery_fee
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
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Vui lòng đăng nhập.'; end if;
  perform public.oncafe_process_expired_qr_orders();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,
    'order_code',o.order_code,
    'status',o.status,
    'payment_method',o.payment_method,
    'payment_status',o.payment_status,
    'total_amount',o.total_amount,
    'delivery_fee',o.delivery_fee,
    'delivery_arrived_at',o.delivery_arrived_at,
    'order_source',o.order_source,
    'fulfillment_method',o.fulfillment_method,
    'customer_address',c.address,
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
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text;
  v_result jsonb;
begin
  select p.role into v_role from public.profiles p where p.id=auth.uid();
  if coalesce(v_role,'') not in ('admin','cashier','seller') then
    raise exception 'Bạn không có quyền xem đơn hàng.';
  end if;

  perform public.oncafe_process_expired_qr_orders();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,
    'order_code',o.order_code,
    'status',o.status,
    'order_source',o.order_source,
    'fulfillment_method',o.fulfillment_method,
    'delivery_fee',o.delivery_fee,
    'delivery_arrived_at',o.delivery_arrived_at,
    'payment_method',o.payment_method,
    'payment_status',o.payment_status,
    'total_amount',o.total_amount,
    'created_at',o.created_at,
    'customer_name',coalesce(o.counter_customer_name,c.full_name,'Khách hàng'),
    'customer_phone',coalesce(o.counter_customer_phone,c.phone),
    'customer_address',coalesce(o.counter_customer_address,c.address),
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
  left join public.customers c on c.id=o.customer_id;

  return v_result;
end;
$function$;

create or replace function public.oncafe_staff_mark_delivery_arrived(p_order_id bigint)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text;
  v_order public.orders%rowtype;
  v_arrived_at timestamptz;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(v_role,'') not in ('admin','cashier','seller') then
    raise exception 'Bạn không có quyền cập nhật đơn giao hàng.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Không tìm thấy đơn hàng.';
  end if;

  if v_order.order_source <> 'online'
     or v_order.fulfillment_method <> 'delivery'
     or v_order.status <> 'delivering' then
    raise exception 'Chỉ ghi nhận đã đến nơi cho đơn online đang giao tận nhà.';
  end if;

  if v_order.payment_status <> 'paid' then
    raise exception 'Đơn giao tận nhà phải được thanh toán trước.';
  end if;

  update public.orders
  set delivery_arrived_at = coalesce(delivery_arrived_at, now())
  where id = p_order_id
  returning delivery_arrived_at into v_arrived_at;

  return v_arrived_at;
end;
$function$;

create or replace function public.oncafe_staff_update_order_status(p_order_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_role text;
  v_order public.orders%rowtype;
begin
  select p.role into v_role from public.profiles p where p.id=auth.uid();
  if coalesce(v_role,'') not in ('admin','cashier','seller') then
    raise exception 'Bạn không có quyền cập nhật đơn hàng.';
  end if;

  if p_status not in ('confirmed','preparing','ready_for_pickup','delivering','completed','rejected') then
    raise exception 'Trạng thái đơn hàng không hợp lệ.';
  end if;

  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng.'; end if;
  if v_order.status in ('completed','cancelled','rejected') then
    raise exception 'Đơn hàng đã kết thúc, không thể thay đổi trạng thái.';
  end if;

  if p_status='confirmed' then
    if v_order.status <> 'pending' then raise exception 'Chỉ xác nhận được đơn đang chờ xử lý.'; end if;
    if v_order.payment_method='qr' and v_order.payment_status <> 'paid' then
      raise exception 'Khách cần xác nhận thanh toán QR trước khi quán xác nhận đơn.';
    end if;
  elsif p_status='rejected' then
    if v_order.status <> 'pending' then raise exception 'Chỉ từ chối được đơn đang chờ xử lý.'; end if;
    if v_order.payment_status='paid' then
      raise exception 'Đơn đã thanh toán. Cần xử lý hoàn tiền trước khi từ chối đơn.';
    end if;
  elsif p_status='preparing' then
    if v_order.status <> 'confirmed' then raise exception 'Chỉ bắt đầu pha chế khi đơn đã được xác nhận.'; end if;
  elsif p_status='ready_for_pickup' then
    if v_order.order_source <> 'online' or v_order.fulfillment_method <> 'pickup' or v_order.status <> 'preparing' then
      raise exception 'Chỉ đơn online nhận tại cửa hàng đang pha chế mới chuyển sang sẵn sàng nhận.';
    end if;
  elsif p_status='delivering' then
    if v_order.status <> 'preparing' then raise exception 'Chỉ chuyển sang giao hàng sau khi pha chế.'; end if;
    if v_order.order_source='online' and v_order.fulfillment_method <> 'delivery' then
      raise exception 'Đơn nhận tại cửa hàng không thể chuyển sang đang giao.';
    end if;
  elsif p_status='completed' then
    if v_order.payment_status <> 'paid' then
      raise exception 'Cần xác nhận đã nhận thanh toán trước khi hoàn tất đơn.';
    end if;
    if v_order.order_source='counter' then
      if v_order.status not in ('confirmed','preparing','delivering') then
        raise exception 'Đơn tại quầy chưa sẵn sàng để hoàn tất.';
      end if;
    elsif v_order.fulfillment_method='pickup' then
      if v_order.status <> 'ready_for_pickup' then
        raise exception 'Đơn nhận tại cửa hàng phải ở trạng thái sẵn sàng nhận trước khi hoàn tất.';
      end if;
    elsif v_order.fulfillment_method='delivery' then
      if v_order.status <> 'delivering' then
        raise exception 'Đơn giao tận nhà phải ở trạng thái đang giao trước khi hoàn tất.';
      end if;
      if v_order.order_source='online' and v_order.delivery_arrived_at is null then
        raise exception 'Nhân viên cần xác nhận đã đến địa chỉ trước khi hoàn tất đơn giao tận nhà.';
      end if;
    end if;
  end if;

  update public.orders set status=p_status where id=p_order_id;

  if p_status='rejected' and coalesce(v_order.stock_deducted,false) then
    update public.products p
    set quantity=p.quantity + reserved.quantity
    from (
      select oi.product_id,sum(oi.quantity)::integer as quantity
      from public.order_items oi
      where oi.order_id=p_order_id and oi.product_id is not null
      group by oi.product_id
    ) reserved
    where p.id=reserved.product_id;

    update public.orders set stock_deducted=false where id=p_order_id;
  end if;

  if p_status='rejected' then
    update public.order_payment_tokens set used_at=coalesce(used_at,now()) where order_id=p_order_id;
  end if;
end;
$function$;

revoke all on function public.oncafe_create_order(text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.oncafe_create_order(text,text,text,text,text,jsonb) to authenticated;

revoke all on function public.oncafe_my_orders() from public, anon;
grant execute on function public.oncafe_my_orders() to authenticated;

revoke all on function public.oncafe_staff_list_orders() from public, anon;
grant execute on function public.oncafe_staff_list_orders() to authenticated;

revoke all on function public.oncafe_staff_mark_delivery_arrived(bigint) from public, anon;
grant execute on function public.oncafe_staff_mark_delivery_arrived(bigint) to authenticated;

revoke all on function public.oncafe_staff_update_order_status(bigint,text) from public, anon;
grant execute on function public.oncafe_staff_update_order_status(bigint,text) to authenticated;
