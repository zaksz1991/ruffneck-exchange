import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-server';

const schema = z.object({
  request_type: z.enum(['product', 'service', 'bulk', 'partnership', 'other']),
  name: z.string().trim().min(2).max(120),
  email: z.email().optional().or(z.literal('')),
  phone: z.string().trim().min(7).max(30),
  state: z.string().trim().min(2).max(60),
  city: z.string().trim().max(100).optional(),
  category: z.string().trim().min(2).max(100),
  details: z.string().trim().min(30).max(4000),
  preferred_contact: z.enum(['phone', 'whatsapp', 'email']),
  consent: z.literal('yes'),
});

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the submitted information and try again.',
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
    const { error } = await db.from('rnx_leads').insert({
      ...parsed.data,
      status: 'new',
      contact_release_status: 'locked',
    });

    if (error) throw error;

    return NextResponse.json(
      { ok: true, message: 'Request received for review.' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[RNX] Customer request could not be saved.', error);
    const missingCredentials =
      error instanceof Error && error.message.includes('Supabase server credentials are missing');

    return NextResponse.json(
      {
        error: missingCredentials
          ? 'Customer requests are temporarily unavailable because the server connection is not configured.'
          : 'We could not save your request right now. Please try again later.',
      },
      { status: missingCredentials ? 503 : 500 },
    );
  }
}
