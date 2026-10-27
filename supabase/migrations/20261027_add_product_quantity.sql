-- ONCafe: add stock quantity required by the existing product manager.
-- Safe to run more than once; existing products receive quantity = 0.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0
CHECK (quantity >= 0);

-- Table grants allow API roles to reach tables; RLS policies still decide
-- which rows and operations each role is allowed to use.
GRANT SELECT ON TABLE public.categories, public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.categories, public.products TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
