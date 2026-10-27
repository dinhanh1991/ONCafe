-- ONCafe: add stock quantity required by the existing product manager.
-- Safe to run once; existing products receive quantity = 0.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0
CHECK (quantity >= 0);
