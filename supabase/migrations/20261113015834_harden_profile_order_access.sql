-- ONCafe security hardening:
-- 1) Protect the last Admin at the database layer (including service-role deletes/updates).
-- 2) Make profiles, orders and order_items read-only through the Data API.
--    Approved writes continue through existing SECURITY DEFINER RPCs and trusted Edge Functions.
-- QR/payment flows and functions are unchanged. The sole related schema adjustment
-- below preserves token rows when a staff Auth user is deleted.

create or replace function public.oncafe_prevent_last_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_count bigint;
begin
  if tg_op = 'UPDATE' then
    if old.role = 'admin' and new.role is distinct from 'admin' then
      -- Serialize Admin demotions so two concurrent requests cannot remove
      -- the final Admin based on the same pre-update count.
      perform pg_catalog.pg_advisory_xact_lock(20261113, 1);

      select count(*)
        into v_admin_count
      from public.profiles p
      where p.role = 'admin';

      if v_admin_count <= 1 then
        raise exception 'Không thể hạ quyền Admin cuối cùng. Hãy tạo một Admin khác trước.'
          using errcode = '23514';
      end if;
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    if old.role = 'admin' then
      -- Use the same transaction-level lock for demotion and deletion.
      perform pg_catalog.pg_advisory_xact_lock(20261113, 1);

      select count(*)
        into v_admin_count
      from public.profiles p
      where p.role = 'admin';

      if v_admin_count <= 1 then
        raise exception 'Không thể xóa Admin cuối cùng. Hãy tạo một Admin khác trước.'
          using errcode = '23514';
      end if;
    end if;

    return old;
  end if;

  return null;
end;
$$;

revoke all on function public.oncafe_prevent_last_admin_change() from public, anon, authenticated;

drop trigger if exists trg_oncafe_prevent_last_admin_change on public.profiles;
create trigger trg_oncafe_prevent_last_admin_change
before update of role or delete
on public.profiles
for each row
execute function public.oncafe_prevent_last_admin_change();

comment on function public.oncafe_prevent_last_admin_change() is
  'Prevents demotion or deletion of the final Admin; enforced for direct SQL, Data API and trusted server-side operations.';

-- Remove broad Admin ALL policies. Existing customer-owned SELECT policies
-- remain in place; the separate Admin views all profiles policy is preserved.
drop policy if exists "Admin manages profiles" on public.profiles;

drop policy if exists "Admin manages orders" on public.orders;
drop policy if exists "Admin views all orders" on public.orders;
create policy "Admin views all orders"
on public.orders
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

drop policy if exists "Admin manages order items" on public.order_items;
drop policy if exists "Admin views all order items" on public.order_items;
create policy "Admin views all order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

-- Defense in depth: RLS controls rows, while SQL privileges control which
-- operations a role can attempt. The app uses RPCs for writes to these tables.
revoke all privileges on table public.profiles, public.orders, public.order_items
  from anon, authenticated;

grant select on table public.profiles, public.orders, public.order_items
  to authenticated;

-- Keep payment-token history when a staff Auth user is deleted.
-- created_by is nullable; retain each token row but clear the deleted user's reference.
alter table public.order_payment_tokens
  drop constraint if exists order_payment_tokens_created_by_fkey;

alter table public.order_payment_tokens
  add constraint order_payment_tokens_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete set null;

-- This existing SECURITY DEFINER RPC writes only the caller's own profile.
-- Pin its search_path to prevent object-shadowing in a privileged function.
alter function public.oncafe_update_my_profile(text, text, text)
  set search_path = '';
