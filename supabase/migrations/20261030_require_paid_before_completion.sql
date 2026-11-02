-- Require payment confirmation before closing an order; prevent rejecting paid orders without a refund flow.
create or replace function public.oncafe_staff_update_order_status(p_order_id bigint,p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.oncafe_staff_update_order_status(bigint,text) from public, anon;
grant execute on function public.oncafe_staff_update_order_status(bigint,text) to authenticated;
