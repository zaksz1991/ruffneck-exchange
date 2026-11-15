import 'server-only';
import { currentSupplierId } from '@/lib/supplier-auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export type PortalSupplier = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  category: string;
  state: string;
  status: string;
  portal_enabled: boolean;
};

export async function getAuthenticatedSupplier(): Promise<PortalSupplier | null> {
  const id = await currentSupplierId();
  if (!id) return null;
  try {
    const db = supabaseAdmin();
    const { error: membershipRefreshError } = await db.rpc('rnx_refresh_supplier_membership', { p_supplier_id: id });
    if (membershipRefreshError) return null;
    const { data, error } = await db
      .from('rnx_supplier_applications')
      .select('id,business_name,contact_name,email,phone,category,state,status,portal_enabled')
      .eq('id', id)
      .eq('status', 'approved')
      .eq('portal_enabled', true)
      .maybeSingle();
    if (error || !data) return null;
    return data as PortalSupplier;
  } catch {
    return null;
  }
}
