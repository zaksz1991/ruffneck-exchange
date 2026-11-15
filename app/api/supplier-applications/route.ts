import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';

const schema = z.object({
  business_name: z.string().trim().min(2).max(150),
  contact_name: z.string().trim().min(2).max(120),
  email: z.email(),
  phone: z.string().trim().min(7).max(30),
  business_type: z.string().trim().max(80),
  category: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(60),
  website: z.string().trim().max(300).optional(),
  description: z.string().trim().min(30).max(3000),
  consent: z.literal('yes'),
});

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the submitted business information and try again.',
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const db = supabaseAdmin();
    const { error } = await db.from('rnx_supplier_applications').insert({
      ...parsed.data,
      status: 'pending',
    });

    if (error) throw error;

    return NextResponse.json(
      { ok: true, message: 'Application received for review.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[RNX] Supplier application could not be saved.', error);
    const missingCredentials =
      error instanceof Error && error.message.includes('Supabase server credentials are missing');

    return NextResponse.json(
      {
        error: missingCredentials
          ? 'Business applications are temporarily unavailable because the server connection is not configured.'
          : 'We could not save your application right now. Please try again later.',
      },
      { status: missingCredentials ? 503 : 500 },
    );
  }
}
