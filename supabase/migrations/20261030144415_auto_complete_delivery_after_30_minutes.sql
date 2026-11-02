-- Automatically complete online delivery orders 30 minutes after staff records arrival.
-- Customer and staff order screens already refresh periodically, so the new status is visible without push notifications.

create or replace function public.oncafe_process_delivery_auto_complete()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_processed integer := 0;
begin
  update public.orders
  set status = 'completed'
  where order_source = 'online'
    and fulfillment_method = 'delivery'
    and status = 'delivering'
    and payment_status = 'paid'
    and delivery_arrived_at is not null
    and delivery_arrived_at <= now() - interval '30 minutes';

  get diagnostics v_processed = row_count;
  return v_processed;
end;
$function$;

revoke all on function public.oncafe_process_delivery_auto_complete() from public, anon, authenticated;

do $schedule$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'oncafe-auto-complete-delivery-after-30m'
  ) then
    perform cron.schedule(
      'oncafe-auto-complete-delivery-after-30m',
      '* * * * *',
      'select public.oncafe_process_delivery_auto_complete();'
    );
  end if;
end;
$schedule$;
