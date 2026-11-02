-- Remove anonymous EXECUTE access from account/profile helper functions.
revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated, service_role;

-- This function is invoked by the auth.users trigger, not through the public RPC API.
revoke all on function public.oncafe_create_customer_profile() from public, anon, authenticated, service_role;

revoke all on function public.oncafe_update_my_profile(text,text,text) from public, anon;
grant execute on function public.oncafe_update_my_profile(text,text,text) to authenticated, service_role;
