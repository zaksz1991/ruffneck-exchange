import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';
import { site, slugify } from '@/lib/site';

export const runtime = 'nodejs';

const MAX_CSV_CHARS = 250_000;
const MAX_IMPORT_ROWS = 25;

const listingSchema = z.object({
  title: z.string().trim().min(3).max(180),
  listing_type: z.enum(['product', 'service', 'wholesale', 'rental']),
  category: z.string().trim().min(2).max(120),
  description: z.string().trim().min(30).max(3000),
  state: z.string().trim().min(2).max(60),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  price_type: z.enum(['enquiry', 'fixed', 'from']),
  price: z.string().trim().max(20).optional().or(z.literal('')),
  keywords: z.string().trim().max(500).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.price_type !== 'enquiry') {
    const price = Number(value.price);
    if (!value.price || !Number.isFinite(price) || price <= 0) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Enter a positive price for fixed/from pricing.' });
    }
  }
});

const requiredHeaders = ['title', 'listing_type', 'category', 'description', 'state', 'city', 'price_type', 'price', 'keywords'] as const;
type ImportRow = Record<(typeof requiredHeaders)[number], string>;

function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error('The CSV contains an unclosed quoted field. Check double quotes and try again.');
  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

function makeSlug(title: string): string {
  return `${slugify(title) || 'offer'}-${randomBytes(4).toString('hex')}`;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });

  const rawBody = await request.text().catch(() => '');
  if (rawBody.length > MAX_CSV_CHARS * 2 + 2_000) return NextResponse.json({ error: 'The CSV request is too large. Maximum supported file size is approximately 250 KB.' }, { status: 413 });
  let body: unknown = null;
  try { body = JSON.parse(rawBody) as unknown; } catch { /* handled as an empty CSV below */ }
  const csv = body && typeof body === 'object' && 'csv' in body && typeof body.csv === 'string' ? body.csv : '';
  if (!csv.trim()) return NextResponse.json({ error: 'Choose a CSV file containing a header row and at least one listing.' }, { status: 400 });
  if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_CHARS) return NextResponse.json({ error: 'The CSV file is too large. Maximum supported file size is 250 KB.' }, { status: 413 });

  let rows: string[][];
  try {
    rows = parseCsv(csv);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The CSV could not be read.' }, { status: 400 });
  }
  if (rows.length < 2) return NextResponse.json({ error: 'The CSV must include a header row and at least one listing.' }, { status: 400 });
  if (rows.length - 1 > MAX_IMPORT_ROWS) return NextResponse.json({ error: `Import up to ${MAX_IMPORT_ROWS} listings per CSV file. Split larger catalogues into separate files.` }, { status: 400 });

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) return NextResponse.json({ error: `Missing CSV columns: ${missingHeaders.join(', ')}.` }, { status: 400 });
  if (new Set(headers).size !== headers.length) return NextResponse.json({ error: 'The CSV header contains duplicate column names.' }, { status: 400 });

  const headerIndexes = new Map(headers.map((header, index) => [header, index]));
  const validRows: Array<z.infer<typeof listingSchema>> = [];
  const rowErrors: string[] = [];

  rows.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const values = Object.fromEntries(requiredHeaders.map((header) => [header, cells[headerIndexes.get(header) ?? -1] ?? ''])) as ImportRow;
    const parsed = listingSchema.safeParse(values);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`).join('; ');
      rowErrors.push(`Row ${rowNumber}: ${detail}`);
      return;
    }
    const matchedState = site.states.find((state) => state.toLowerCase() === parsed.data.state.toLowerCase());
    if (!matchedState) {
      rowErrors.push(`Row ${rowNumber}: state must be a Nigerian state or FCT listed in the RNX template.`);
      return;
    }
    validRows.push({ ...parsed.data, state: matchedState });
  });

  if (rowErrors.length) return NextResponse.json({ error: 'No listings were imported because the CSV contains invalid rows.', rowErrors: rowErrors.slice(0, 12), errorCount: rowErrors.length }, { status: 400 });
  if (!validRows.length) return NextResponse.json({ error: 'No valid listing rows were found.' }, { status: 400 });

  try {
    const db = supabaseAdmin();
    const { data: membership, error: membershipError } = await db.from('rnx_membership_subscriptions')
      .select('id,plan:rnx_membership_plans!inner(listing_limit)')
      .eq('supplier_application_id', supplier.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (membershipError || !membership) return NextResponse.json({ error: 'An active supplier membership is required before importing catalogue listings.' }, { status: 409 });
    const membershipPlan = Array.isArray(membership.plan) ? membership.plan[0] : membership.plan;
    const limit = Number(membershipPlan?.listing_limit ?? 0);
    const { count, error: countError } = await db.from('rnx_listings').select('id', { count: 'exact', head: true })
      .eq('supplier_application_id', supplier.id).in('status', ['pending', 'approved', 'paused']);
    if (countError) return NextResponse.json({ error: 'The catalogue limit could not be checked. No listings were imported.' }, { status: 503 });
    const remaining = Math.max(0, limit - (count ?? 0));
    if (validRows.length > remaining) {
      return NextResponse.json({ error: `Your active plan has ${remaining} available catalogue slot(s), but this file contains ${validRows.length} listings. Upgrade your plan or import fewer rows.` }, { status: 409 });
    }

    const inserts = validRows.map((values) => ({
      supplier_application_id: supplier.id,
      title: values.title,
      slug: makeSlug(values.title),
      listing_type: values.listing_type,
      category: values.category,
      description: values.description,
      state: values.state,
      city: values.city || null,
      price_type: values.price_type,
      price: values.price ? Number(values.price) : null,
      currency: 'NGN',
      keywords: (values.keywords || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20),
      status: 'pending',
    }));
    const { data, error } = await db.from('rnx_listings').insert(inserts).select('id,title,status');
    if (error || !data) {
      console.error('[RNX supplier CSV catalogue import]', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'The catalogue import could not be saved. No import confirmation was recorded.' }, { status: 503 });
    }

    return NextResponse.json({
      ok: true,
      created: data.length,
      listings: data,
      message: `${data.length} listing(s) imported and submitted for RNX review. They remain hidden until approved.`,
    }, { status: 201 });
  } catch (error) {
    console.error('[RNX supplier CSV catalogue import]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Catalogue import is temporarily unavailable.' }, { status: 503 });
  }
}
