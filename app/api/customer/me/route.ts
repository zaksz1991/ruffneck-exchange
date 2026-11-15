import { NextResponse } from 'next/server';
import { currentCustomerId } from '@/lib/customer-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
export const runtime = 'nodejs';
export async function GET() {
  const id = await currentCustomerId(); if (!id) return NextResponse.json({ customer: null }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try { const { data, error } = await supabaseAdmin().from('rnx_customers').select('id,name,email,phone,created_at').eq('id', id).eq('status','active').maybeSingle(); if (error || !data) return NextResponse.json({ customer: null }, { status: 401 }); return NextResponse.json({ customer: data }, { headers: { 'Cache-Control': 'no-store, private' } }); }
  catch { return NextResponse.json({ error: 'Customer account is unavailable.' }, { status: 503 }); }
}
