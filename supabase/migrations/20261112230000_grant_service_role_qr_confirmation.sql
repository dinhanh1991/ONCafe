-- Chỉ Edge Function dùng service_role được gọi RPC xác nhận QR.
-- Client anon/authenticated không được gọi trực tiếp RPC SECURITY DEFINER này.
revoke all on function public.oncafe_public_confirm_qr_payment(text)
  from public, anon, authenticated;

grant execute on function public.oncafe_public_confirm_qr_payment(text)
  to service_role;
