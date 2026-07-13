export const PROPOSAL_WITH_VERSIONS_SELECT = [
  "id,organization_id,case_id,status,current_version_id,created_at,updated_at",
  "cases(id,case_code,title,destination,trip_start,trip_end,client_id,clients(display_name,email,phone))",
  "proposal_versions:proposal_versions!proposal_versions_proposal_id_fkey(id,organization_id,proposal_id,version_number,status,locked,created_at,expires_at,total_sale,total_cost,total_cost_budget,budgeted_profit,budget_lines(id,proposal_version_id,stable_line_id,service_type_code,description_public,description_internal,supplier_id,supplier_name,destination_segment,start_date,end_date,cost_budget,margin_applied,sale_price,creates_expected_purchase,sort_order,created_at))",
].join(",");

export const PURCHASE_WITH_RELATIONS_SELECT = [
  "*",
  "cases(id,case_code,title)",
  "budget_lines:budget_lines!expected_purchases_budget_line_id_fkey(id,service_type_code,description_public,description_internal,destination_segment,start_date,end_date,cost_budget,sale_price)",
  "supplier_invoices(id,status,invoice_number,invoice_date,total,currency,storage_path,created_at)",
].join(",");
