import { NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/admin-auth';
import { SUPPLIER_COOKIE, supplierCookieOptions } from '@/lib/supplier-auth';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Request rejected.' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SUPPLIER_COOKIE, '', { ...supplierCookieOptions(), maxAge: 0 });
  return response;
}
