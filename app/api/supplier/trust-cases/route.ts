import { NextResponse } from 'next/server';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store, private' };

export async function GET() {
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401, headers: PRIVATE_HEADERS });
  try {
    const db = supabaseAdmin();
    const { data: rows, error } = await db.from('rnx_trust_cases')
      .select('id,case_reference,case_type,summary,description,requested_resolution,status,created_at,updated_at,supplier_response_requested_at')
      .eq('supplier_application_id', supplier.id)
      .not('supplier_response_requested_at', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const cases = rows ?? [];
    let messages: any[] = [];
    if (cases.length) {
      const { data, error: messageError } = await db.from('rnx_trust_case_messages')
        .select('id,trust_case_id,sender_role,sender_name,visibility,body,created_at')
        .in('trust_case_id', cases.map((row) => row.id))
        .eq('visibility', 'customer')
        .order('created_at', { ascending: true })
        .limit(1000);
      if (messageError) throw messageError;
      messages = data ?? [];
    }

    return NextResponse.json({
      cases: cases.map((row) => ({
        ...row,
        can_respond: row.status === 'awaiting_supplier',
        messages: messages.filter((message) => message.trust_case_id === row.id),
      })),
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('[RNX supplier trust cases] Could not load assigned cases:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Supplier case responses are temporarily unavailable. Confirm migration 029 is applied.' }, { status: 503, headers: PRIVATE_HEADERS });
  }
}
