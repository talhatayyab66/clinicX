import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. SERVER ONLY. Never import into client components.
 * Bypasses RLS — only use inside protected server routes after verifying
 * the caller is an admin.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
