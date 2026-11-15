import { NextResponse } from 'next/server';
import { currentCustomerId } from '@/lib/customer-auth';
import { supabaseAdmin } from '@/lib/supabase-server';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET() {
  const customerId = await currentCustomerId(); if (!customerId) return NextResponse.json({ error: 'Sign in to view your requests.' }, { status: 401 });
  try {
    const db = supabaseAdmin();
    const { data: requests, error } = await db.from('rnx_leads').select('id,request_type,name,state,city,category,details,status,contact_release_status,created_at,last_activity_at').eq('customer_id', customerId).order('created_at',{ascending:false}).limit(100);
    if (error) throw error;
    const ids = (requests || []).map((row: any) => row.id);
    let messages: any[] = [];
    if (ids.length) { const result = await db.from('rnx_lead_messages').select('id,lead_id,sender_role,sender_name,body,created_at').in('lead_id', ids).order('created_at',{ascending:true}).limit(500); if (result.error) throw result.error; messages = result.data || []; }
    return NextResponse.json({ requests: (requests || []).map((row: any) => ({ ...row, messages: messages.filter(m => m.lead_id === row.id) })) }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) { console.error('[RNX customer] Request list failed:', error instanceof Error ? error.message : 'unknown'); return NextResponse.json({ error: 'Your requests could not be loaded.' }, { status: 503 }); }
}
