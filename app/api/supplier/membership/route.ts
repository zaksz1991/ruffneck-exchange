import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({ planCode: z.enum(['starter','growth','enterprise']), billingInterval: z.enum(['monthly','annual']).default('monthly') });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Select a valid membership plan.' }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: plan, error: planError } = await db.from('rnx_membership_plans')
      .select('id,code,name,price,active').eq('code', parsed.data.planCode).eq('active', true).maybeSingle();
    if (planError || !plan) return NextResponse.json({ error: 'That membership plan is unavailable.' }, { status: 404 });

    const { data: pending } = await db.from('rnx_membership_subscriptions')
      .select('id,status,plan:rnx_membership_plans!inner(code,name)')
      .eq('supplier_application_id', supplier.id).in('status', ['requested','awaiting_payment']).limit(1).maybeSingle();
    if (pending) return NextResponse.json({ error: 'You already have a membership request in progress. Complete or resolve it before requesting another plan.' }, { status: 409 });

    if (plan.code === 'starter') {
      const { error: supersedeError } = await db.from('rnx_membership_subscriptions').update({ status: 'superseded', updated_at: new Date().toISOString() })
        .eq('supplier_application_id', supplier.id).eq('status', 'active');
      if (supersedeError) return NextResponse.json({ error: 'The previous membership could not be updated.' }, { status: 503 });
    }
    const status = plan.code === 'starter' ? 'active' : 'requested';
    const { data: subscription, error } = await db.from('rnx_membership_subscriptions').insert({
      supplier_application_id: supplier.id,
      plan_id: plan.id,
      status,
      quoted_amount: plan.code === 'starter' ? 0 : null,
      currency: 'NGN',
      billing_interval: parsed.data.billingInterval,
      period_start: plan.code === 'starter' ? new Date().toISOString() : null,
    }).select('id,status').single();
    if (error || !subscription) {
      console.error('[RNX membership request]', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'The membership request could not be saved.' }, { status: 503 });
    }
    await db.from('rnx_membership_events').insert({ subscription_id: subscription.id, event_type: plan.code === 'starter' ? 'starter_plan_selected' : 'plan_requested', details: { plan_code: plan.code, billing_interval: parsed.data.billingInterval } });
    return NextResponse.json({ ok: true, status: subscription.status, message: plan.code === 'starter' ? 'Starter membership activated.' : 'Membership request submitted. RNX operations will issue commercial terms before any payment is due.' }, { status: 201 });
  } catch (error) {
    console.error('[RNX membership request]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Membership operations are temporarily unavailable.' }, { status: 503 });
  }
}
