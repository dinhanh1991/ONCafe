-- ONCafe: let each signed-in user update only their own contact details.
-- Email and role are intentionally excluded from the update function.

alter table public.profiles
    add column if not exists phone text,
    add column if not exists address text;

create or replace function public.oncafe_update_my_profile(
    p_full_name text,
    p_phone text default '',
    p_address text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    current_user_id uuid := auth.uid();
    updated_profile public.profiles%rowtype;
begin
    if current_user_id is null then
        raise exception 'Bạn cần đăng nhập để cập nhật thông tin.';
    end if;

    if p_full_name is null or length(trim(p_full_name)) < 2 or length(trim(p_full_name)) > 100 then
        raise exception 'Họ và tên phải có từ 2 đến 100 ký tự.';
    end if;

    if length(coalesce(p_phone, '')) > 25 then
        raise exception 'Số điện thoại không được vượt quá 25 ký tự.';
    end if;

    if length(coalesce(p_address, '')) > 250 then
        raise exception 'Địa chỉ không được vượt quá 250 ký tự.';
    end if;

    update public.profiles
    set full_name = trim(p_full_name),
        phone = nullif(trim(coalesce(p_phone, '')), ''),
        address = nullif(trim(coalesce(p_address, '')), '')
    where id = current_user_id
    returning * into updated_profile;

    if not found then
        raise exception 'Không tìm thấy hồ sơ tài khoản.';
    end if;

    -- Keep the signed-in customer's checkout contact information in sync, if present.
    update public.customers
    set full_name = trim(p_full_name),
        phone = nullif(trim(coalesce(p_phone, '')), ''),
        address = nullif(trim(coalesce(p_address, '')), '')
    where user_id = current_user_id;

    return jsonb_build_object(
        'id', updated_profile.id,
        'full_name', updated_profile.full_name,
        'phone', updated_profile.phone,
        'address', updated_profile.address,
        'role', updated_profile.role
    );
end;
$$;

revoke all on function public.oncafe_update_my_profile(text, text, text) from public;
grant execute on function public.oncafe_update_my_profile(text, text, text) to authenticated;
