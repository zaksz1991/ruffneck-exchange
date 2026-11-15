import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({
  request_type: z.enum(['product', 'service', 'bulk', 'partnership', 'other']),
  name: z.string().trim().min(2).max(120),
  email: z.union([z.string().trim().email().max(254), z.literal('')]).optional(),
  phone: z.string().trim().min(7).max(30),
  state: z.string().trim().min(2).max(60),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  category: z.string().trim().min(2).max(100),
  details: z.string().trim().min(30).max(4000),
  preferred_contact: z.enum(['phone', 'whatsapp', 'email']),
  consent: z.literal('yes')
});

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Some details are missing or invalid. Review the form and try again.', issues: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { error } = await db.from('rnx_leads').insert({
      ...parsed.data,
      email: parsed.data.email || null,
      city: parsed.data.city || null,
      status: 'new',
      contact_release_status: 'locked'
    });
    if (error) {
      console.error('[RNX] Lead insert failed:', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'We could not save your request right now. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: 'Request received for review.' }, { status: 201 });
  } catch (error) {
    console.error('[RNX] Lead endpoint unavailable:', error instanceof Error ? error.message : 'Unknown server error');
    return NextResponse.json({ error: 'Customer request submission is temporarily unavailable. Please try again later.' }, { status: 503 });
  }
}
