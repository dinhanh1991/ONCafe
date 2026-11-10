-- Lưu thông báo riêng cho từng nhân viên và phát sự kiện qua Supabase Realtime.
-- Mỗi người nhận có trạng thái đã đọc độc lập; không phụ thuộc Local Storage của trình duyệt.

create table if not exists public.staff_notifications (
    id uuid primary key default gen_random_uuid(),
    recipient_id uuid not null references auth.users(id) on delete cascade,
    event_type text not null,
    payload jsonb not null,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists idx_staff_notifications_recipient_created
    on public.staff_notifications (recipient_id, created_at desc);

create index if not exists idx_staff_notifications_unread
    on public.staff_notifications (recipient_id, is_read, created_at desc);

alter table public.staff_notifications enable row level security;
revoke all on public.staff_notifications from anon, public, authenticated;
grant select on public.staff_notifications to authenticated;
grant update (is_read) on public.staff_notifications to authenticated;

drop policy if exists "Staff read own notifications" on public.staff_notifications;
create policy "Staff read own notifications"
on public.staff_notifications
for select
to authenticated
using (recipient_id = (select auth.uid()));

drop policy if exists "Staff mark own notifications read" on public.staff_notifications;
create policy "Staff mark own notifications read"
on public.staff_notifications
for update
to authenticated
using (recipient_id = (select auth.uid()))
with check (recipient_id = (select auth.uid()));

create or replace function public.oncafe_broadcast_to_roles(
    p_roles text[],
    p_event text,
    p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.staff_notifications (recipient_id, event_type, payload)
    select p.id, p_event, p_payload
    from public.profiles p
    where p.role = any (p_roles)
      and (
        nullif(p_payload ->> 'actor', '') is null
        or p.id::text <> (p_payload ->> 'actor')
      );
end;
$$;

revoke all on function public.oncafe_broadcast_to_roles(text[], text, jsonb)
from public, anon, authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'staff_notifications'
    ) then
        alter publication supabase_realtime add table public.staff_notifications;
    end if;
end;
$$;
