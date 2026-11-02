-- ONCafe counter orders and payment status. Apply after existing staff order migrations.
alter table public.orders
  add column if not exists counter_customer_name text,
  add column if not exists counter_customer_phone text,
  add column if not exists counter_customer_address text;

create or replace function public.oncafe_staff_create_order(
  p_customer_name text, p_customer_phone text, p_customer_address text,
  p_payment_method text, p_items jsonb
) returns table(order_id bigint, order_code text, total_amount numeric)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); v_role text; v_id bigint; v_code text;
  v_total numeric(12,2); v_count integer; v_valid integer;
begin
  select role into v_role from public.profiles where id = v_uid;
  if v_uid is null or coalesce(v_role,'') not in ('admin','seller','cashier') then
    raise exception 'Bạn không có quyền tạo đơn tại quầy.';
  end if;
  if nullif(trim(coalesce(p_customer_name,'')),'') is null then raise exception 'Vui lòng nhập tên khách hàng.'; end if;
  if p_payment_method not in ('cash','qr') then raise exception 'Phương thức thanh toán không hợp lệ.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Giỏ hàng đang trống.'; end if;
  if exists(select 1 from jsonb_to_recordset(p_items) x(id bigint, quantity integer) where id is null or quantity is null or quantity < 1 or quantity > 99) then
    raise exception 'Số lượng đồ uống không hợp lệ.';
  end if;
  select count(*) into v_count from jsonb_to_recordset(p_items) x(id bigint, quantity integer);
  if v_count <> (select count(distinct id) from jsonb_to_recordset(p_items) x(id bigint, quantity integer)) then raise exception 'Giỏ hàng có đồ uống trùng.'; end if;
  perform p.id from public.products p join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on p.id=x.id order by p.id for update of p;
  select count(*) into v_valid from public.products p join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on p.id=x.id where p.is_available and p.quantity >= x.quantity;
  if v_valid <> v_count then raise exception 'Có đồ uống ngừng bán hoặc không đủ tồn kho.'; end if;
  select coalesce(sum(p.price*x.quantity),0) into v_total from public.products p join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on p.id=x.id where p.is_available;
  v_code := 'ONC-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.orders(customer_id,created_by,order_code,status,payment_method,payment_status,total_amount,stock_deducted,counter_customer_name,counter_customer_phone,counter_customer_address)
  values(null,v_uid,v_code,'pending',p_payment_method,'unpaid',v_total,true,trim(p_customer_name),nullif(trim(coalesce(p_customer_phone,'')),''),nullif(trim(coalesce(p_customer_address,'')),'')) returning id into v_id;
  insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,subtotal)
  select v_id,p.id,p.name,p.price,x.quantity,p.price*x.quantity from public.products p join jsonb_to_recordset(p_items) x(id bigint, quantity integer) on p.id=x.id where p.is_available;
  update public.products p set quantity=p.quantity-x.quantity from jsonb_to_recordset(p_items) x(id bigint, quantity integer) where p.id=x.id;
  return query select v_id,v_code,v_total;
end; $$;

create or replace function public.oncafe_staff_update_payment(p_order_id bigint,p_payment_status text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role text; v_status text;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if coalesce(v_role,'') not in ('admin','seller','cashier') then raise exception 'Bạn không có quyền cập nhật thanh toán.'; end if;
  if p_payment_status not in ('paid','unpaid') then raise exception 'Trạng thái thanh toán không hợp lệ.'; end if;
  select status into v_status from public.orders where id=p_order_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng.'; end if;
  if v_status in ('cancelled','rejected') then raise exception 'Đơn hàng đã kết thúc.'; end if;
  update public.orders set payment_status=p_payment_status where id=p_order_id;
end; $$;

create or replace function public.oncafe_staff_list_orders()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_role text; v_result jsonb;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if coalesce(v_role,'') not in ('admin','cashier','seller') then raise exception 'Bạn không có quyền xem đơn hàng.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'order_code',o.order_code,'status',o.status,'payment_method',o.payment_method,
    'payment_status',o.payment_status,'total_amount',o.total_amount,'created_at',o.created_at,
    'customer_name',coalesce(o.counter_customer_name,c.full_name,'Khách hàng'),
    'customer_phone',coalesce(o.counter_customer_phone,c.phone),
    'customer_address',coalesce(o.counter_customer_address,c.address),
    'items',coalesce((select jsonb_agg(jsonb_build_object('product_name',i.product_name,'unit_price',i.unit_price,'quantity',i.quantity,'subtotal',i.subtotal) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb)
  ) order by o.created_at desc),'[]'::jsonb) into v_result
  from public.orders o left join public.customers c on c.id=o.customer_id;
  return v_result;
end; $$;

revoke all on function public.oncafe_staff_create_order(text,text,text,text,jsonb) from public;
revoke all on function public.oncafe_staff_update_payment(bigint,text) from public;
revoke all on function public.oncafe_staff_list_orders() from public;
grant execute on function public.oncafe_staff_create_order(text,text,text,text,jsonb) to authenticated;
grant execute on function public.oncafe_staff_update_payment(bigint,text) to authenticated;
grant execute on function public.oncafe_staff_list_orders() to authenticated;
