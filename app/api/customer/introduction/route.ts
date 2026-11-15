import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[a-f0-9]{64}$/i.test(token)) return NextResponse.json({ error: 'This approval link is invalid.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.from('rnx_lead_offers').select(
      'id,anonymised_summary,customer_approved_at,customer_declined_at,customer_approval_token_expires_at,supplier:rnx_supplier_applications!inner(business_name,category,state),lead:rnx_leads!inner(category,state,city)'
    ).eq('customer_approval_token_hash', hashToken(token)).maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'This approval link is invalid or no longer available.' }, { status: 404 });
    const supplier = data.supplier as unknown as { business_name: string; category: string; state: string };
    const lead = data.lead as unknown as { category: string; state: string; city: string | null };
    const expiry = data.customer_approval_token_expires_at ? new Date(data.customer_approval_token_expires_at).getTime() : 0;
    const decided = Boolean(data.customer_approved_at || data.customer_declined_at);
    if (!decided && (!expiry || expiry <= Date.now())) return NextResponse.json({ error: 'This approval link has expired. Contact RuffNeck Exchange for a new link.' }, { status: 410 });
    return NextResponse.json({ offer: {
      supplierName: supplier.business_name, supplierCategory: supplier.category, supplierState: supplier.state,
      requirementCategory: lead.category, requirementLocation: [lead.city, lead.state].filter(Boolean).join(', '),
      summary: data.anonymised_summary,
      decision: data.customer_approved_at ? 'approved' : data.customer_declined_at ? 'declined' : 'pending',
    } }, { headers: { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer' } });
  } catch (error) {
    console.error('[RNX customer introduction] Lookup failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The introduction service is temporarily unavailable.' }, { status: 503 });
  }
}

const responseSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i), decision: z.enum(['approved', 'declined']) });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const raw: unknown = await request.json().catch(() => null);
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'The approval response is invalid.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc('rnx_respond_to_introduction', { p_token_hash: hashToken(parsed.data.token), p_decision: parsed.data.decision });
    if (error) {
      console.error('[RNX customer introduction] Decision RPC failed:', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Your response could not be saved. Confirm migration 004 is applied.' }, { status: 503 });
    }
    const result = data as { ok?: boolean; decision?: string; error?: string };
    if (!result?.ok) return NextResponse.json({ error: result?.error || 'Your response could not be accepted.' }, { status: 409 });
    return NextResponse.json({ ok: true, decision: result.decision }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('[RNX customer introduction] Decision failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The introduction service is temporarily unavailable.' }, { status: 503 });
  }
}
