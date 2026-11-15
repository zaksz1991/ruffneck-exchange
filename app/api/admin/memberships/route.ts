import { NextResponse } from 'next/server';
import { getAdminSession, hasPermission } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getAdminSession();
  if (!actor) return NextResponse.json({ error: 'Administrator sign-in required.' }, { status: 401 });
  if (!hasPermission(actor.role, 'memberships:read')) return NextResponse.json({ error: 'You do not have permission to view membership records.' }, { status: 403 });
  try {
    const db = supabaseAdmin();
    const [subscriptions, suppliers] = await Promise.all([
      db.from('rnx_membership_subscriptions').select('id,status,quoted_amount,currency,billing_interval,quote_expires_at,period_start,period_end,created_at,supplier:rnx_supplier_applications!inner(id,business_name,email,phone,status),plan:rnx_membership_plans!inner(code,name,listing_limit),payments:rnx_membership_payments(id,amount,currency,payment_method,transaction_reference,status,supplier_note,received_amount,received_currency,verified_reference,verified_at,created_at)')
        .order('created_at', { ascending: false }).limit(150),
      db.from('rnx_supplier_applications').select('id,business_name,email,phone,status,portal_enabled,portal_password_hash,created_at')
        .eq('status', 'approved').order('business_name', { ascending: true }).limit(500),
    ]);
    if (subscriptions.error || suppliers.error) {
      const error = subscriptions.error || suppliers.error;
      console.error('[RNX admin memberships]', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'Membership records could not be loaded. Confirm migration 005 is applied.' }, { status: 503 });
    }
    const safeSuppliers = (suppliers.data ?? []).map((row: any) => ({
      id: row.id, business_name: row.business_name, email: row.email, phone: row.phone,
      portal_access: Boolean(row.portal_enabled && row.portal_password_hash),
      invite_pending: Boolean(row.portal_invite_token_hash && row.portal_invite_expires_at && new Date(row.portal_invite_expires_at).getTime() > Date.now()),
    }));
    return NextResponse.json({ subscriptions: subscriptions.data ?? [], suppliers: safeSuppliers }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX admin memberships]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Membership operations are temporarily unavailable.' }, { status: 503 });
  }
}
