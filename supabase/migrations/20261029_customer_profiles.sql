-- ONCafe: automatically create a customer profile for newly registered auth users.
-- Existing profiles (including admin profiles) are never overwritten.

create or replace function public.oncafe_create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, role)
    values (
        new.id,
        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
            split_part(coalesce(new.email, 'Khach hang'), '@', 1)
        ),
        'customer'
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists oncafe_create_customer_profile_after_signup on auth.users;

create trigger oncafe_create_customer_profile_after_signup
after insert on auth.users
for each row
execute function public.oncafe_create_customer_profile();

-- Backfill accounts created before this trigger, without changing any existing profile or role.
insert into public.profiles (id, full_name, role)
select
    u.id,
    coalesce(
        nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
        split_part(coalesce(u.email, 'Khach hang'), '@', 1)
    ),
    'customer'
from auth.users u
where not exists (
    select 1
    from public.profiles p
    where p.id = u.id
);
