import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Publishable key is intended for browser use. Database access is controlled by RLS.
const SUPABASE_URL = "https://wmxkxfalcddhcijiuxxq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zMXRwAe2NB62KcWcW_UvGA_3G-ESxqu";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
