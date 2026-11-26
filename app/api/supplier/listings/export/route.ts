import { NextResponse } from 'next/server';
import { getAuthenticatedSupplier } from '@/lib/supplier-session';
import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1_000;
const MAX_EXPORT_ROWS = 10_000;
const EXPORT_STATUSES = ['all', 'approved', 'pending', 'paused', 'rejected'] as const;
type ExportStatus = (typeof EXPORT_STATUSES)[number];

const SELECT_COLUMNS = [
  'id', 'title', 'slug', 'listing_type', 'category', 'description', 'state', 'city',
  'price_type', 'price', 'currency', 'keywords', 'status', 'availability_status',
  'availability_note', 'availability_updated_at', 'created_at', 'updated_at',
].join(',');

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined
    ? ''
    : Array.isArray(value)
      ? value.join(', ')
      : String(value);
  // Prefix spreadsheet formula-like values so opening the export cannot execute them.
  const safe = /^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

export async function GET(request: Request) {
  const supplier = await getAuthenticatedSupplier();
  if (!supplier) {
    return NextResponse.json({ error: 'Supplier sign-in required.' }, { status: 401 });
  }

  const requestedStatus = new URL(request.url).searchParams.get('status') || 'all';
  if (!EXPORT_STATUSES.includes(requestedStatus as ExportStatus)) {
    return NextResponse.json({ error: 'Choose all, approved, pending, paused or rejected listings.' }, { status: 400 });
  }
  const status = requestedStatus as ExportStatus;

  try {
    const db = supabaseAdmin();
    const loadPage = async (offset: number) => {
      let query = db.from('rnx_listings')
        .select(SELECT_COLUMNS, offset === 0 ? { count: 'exact' } : undefined)
        .eq('supplier_application_id', supplier.id);
      if (status !== 'all') query = query.eq('status', status);
      return query.order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
    };

    const firstPage = await loadPage(0);
    if (firstPage.error) throw firstPage.error;
    const total = firstPage.count ?? firstPage.data?.length ?? 0;
    if (total > MAX_EXPORT_ROWS) {
      return NextResponse.json({ error: `This export contains ${total.toLocaleString('en-NG')} listings. Export a smaller status group; the per-file limit is ${MAX_EXPORT_ROWS.toLocaleString('en-NG')}.` }, { status: 413 });
    }

    const listings: Array<Record<string, unknown>> = [...(firstPage.data ?? [])] as Array<Record<string, unknown>>;
    for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
      const page = await loadPage(offset);
      if (page.error) throw page.error;
      listings.push(...((page.data ?? []) as Array<Record<string, unknown>>));
    }

    const headers = [
      'listing_id', 'title', 'listing_type', 'category', 'description', 'state', 'city',
      'price_type', 'price', 'currency', 'keywords', 'moderation_status',
      'availability_status', 'availability_note', 'availability_updated_at',
      'listing_slug', 'created_at', 'updated_at',
    ];
    const rows = listings.map((listing) => csvRow([
      listing.id,
      listing.title,
      listing.listing_type,
      listing.category,
      listing.description,
      listing.state,
      listing.city,
      listing.price_type,
      listing.price,
      listing.currency,
      listing.keywords,
      listing.status,
      listing.availability_status,
      listing.availability_note,
      listing.availability_updated_at,
      listing.slug,
      listing.created_at,
      listing.updated_at,
    ]));
    const csv = `\uFEFF${[csvRow(headers), ...rows].join('\r\n')}\r\n`;
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `ruffneck-exchange-catalogue-${status}-${date}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[RNX supplier catalogue export]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'The catalogue export could not be generated. No catalogue data was changed.' }, { status: 503 });
  }
}
