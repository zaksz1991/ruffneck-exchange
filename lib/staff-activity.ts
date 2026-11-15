import 'server-only';
import type { AdminSession } from '@/lib/admin-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function recordStaffActivity(
  db: SupabaseClient,
  actor: AdminSession,
  eventType: string,
  entityType?: string,
  entityId?: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db.from('rnx_staff_activity').insert({
    actor_staff_id: actor.id,
    actor_email: actor.email,
    actor_role: actor.role,
    event_type: eventType,
    entity_type: entityType || null,
    entity_id: entityId || null,
    details,
  });
  if (error) console.error('[RNX staff activity] Write failed:', { code: error.code, message: error.message, eventType });
}
