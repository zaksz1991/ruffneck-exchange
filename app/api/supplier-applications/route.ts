import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
const schema = z.object({
  business_name: z.string().trim().min(2).max(180),
  contact_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  business_type: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(60),
  website: z.union([z.string().trim().url().max(300), z.literal('')]).optional(),
  description: z.string().trim().min(30).max(3000),
  consent: z.literal('yes')
});

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Some business details are missing or invalid. Review the form and try again.', issues: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { error } = await db.from('rnx_supplier_applications').insert({ ...parsed.data, website: parsed.data.website || null, status: 'pending' });
    if (error) {
      console.error('[RNX] Supplier application insert failed:', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'We could not save the application right now. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: 'Application received for review.' }, { status: 201 });
  } catch (error) {
    console.error('[RNX] Supplier endpoint unavailable:', error instanceof Error ? error.message : 'Unknown server error');
    return NextResponse.json({ error: 'Business application submission is temporarily unavailable. Please try again later.' }, { status: 503 });
  }
}
