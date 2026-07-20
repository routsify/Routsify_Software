import { getSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase-admin";

export type Supplier360Data = {
  supplier: Record<string, unknown>;
  services: Record<string, unknown>[];
  incidents: Record<string, unknown>[];
  purchases: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  communications: Record<string, unknown>[];
  asOf: string;
};

export async function getOrganizationSupplier360(organizationId: string, supplierId: string): Promise<{ ok: true; data: Supplier360Data } | { ok: false; error: string }> {
  if (!hasSupabaseAdminEnv()) return { ok: false, error: "supabase_admin_not_configured" };
  const db = getSupabaseAdminClient();
  const { data: supplier, error: supplierError } = await db
    .from("suppliers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", supplierId)
    .maybeSingle();
  if (supplierError) return { ok: false, error: supplierError.message };
  if (!supplier) return { ok: false, error: "supplier_not_found" };

  const [servicesResult, incidentsResult, purchasesResult, invoicesResult, documentsResult, communicationsResult] = await Promise.all([
    db.from("supplier_services")
      .select("id,supplier_id,name,category,destination,currency,unit,base_cost,tax_rate,valid_from,valid_until,active,notes,created_at,updated_at")
      .eq("organization_id", organizationId)
      .eq("supplier_id", supplierId)
      .order("active", { ascending: false })
      .order("name", { ascending: true }),
    db.from("supplier_incidents")
      .select("id,supplier_id,case_id,severity,status,title,description,occurred_at,resolved_at,created_at,updated_at,cases(case_code,destination)")
      .eq("organization_id", organizationId)
      .eq("supplier_id", supplierId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    db.from("expected_purchases")
      .select("id,case_id,supplier_id,status,service,expected_amount,approved_cost,invoice_total,currency,due_date,invoice_number,invoice_date,sync_status,holded_purchase_id,created_at,updated_at,cases(case_code,destination,trip_start,trip_end,currency)")
      .eq("organization_id", organizationId)
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(300),
    db.from("supplier_invoices")
      .select("id,expected_purchase_id,supplier_id,invoice_number,invoice_date,base_amount,tax_amount,total_amount,total,currency,status,sync_status,holded_purchase_id,file_name,uploaded_at,reviewed_at,approved_at,created_at,updated_at")
      .eq("organization_id", organizationId)
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(300),
    db.from("documents")
      .select("id,owner_type,owner_id,case_id,title,document_type,type,status,file_name,mime_type,size_bytes,created_at,updated_at")
      .eq("organization_id", organizationId)
      .eq("owner_type", "supplier")
      .eq("owner_id", supplierId)
      .is("purged_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("communication_followups")
      .select("id,supplier_id,purchase_id,case_id,kind,channel,subject,body,status,due_at,sent_at,answered_at,provider_status,delivered_at,read_at,failed_at,provider_error,created_at,updated_at")
      .eq("organization_id", organizationId)
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const firstError = [servicesResult.error, incidentsResult.error, purchasesResult.error, invoicesResult.error, documentsResult.error, communicationsResult.error].find(Boolean);
  if (firstError) return { ok: false, error: firstError.message };

  return {
    ok: true,
    data: {
      supplier: supplier as Record<string, unknown>,
      services: (servicesResult.data || []) as Record<string, unknown>[],
      incidents: (incidentsResult.data || []) as Record<string, unknown>[],
      purchases: (purchasesResult.data || []) as Record<string, unknown>[],
      invoices: (invoicesResult.data || []) as Record<string, unknown>[],
      documents: (documentsResult.data || []) as Record<string, unknown>[],
      communications: (communicationsResult.data || []) as Record<string, unknown>[],
      asOf: new Date().toISOString(),
    },
  };
}
