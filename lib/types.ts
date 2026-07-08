export type Client = {
  id: string;
  display_name: string;
  client_type: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  email_normalized?: string | null;
  phone?: string | null;
  phone_normalized?: string | null;
  tax_id?: string | null;
  billing_address?: unknown;
  country?: string | null;
  language?: string | null;
  source?: string | null;
  holded_contact_id?: string | null;
  notes?: string | null;
};

export type ServiceType = {
  id?: string;
  code: string;
  name: string;
  active?: boolean;
  is_active?: boolean;
  sort_order?: number;
};
