import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  // Prefer Supabase's current server-only secret key. The legacy service-role
  // variable remains as a fallback for existing deployments during migration.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase server credentials are missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY in the deployment environment.'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
