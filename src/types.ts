// -------------------------------------------------------
// Auth & Users
// -------------------------------------------------------
export type LegacyUserRole = 'admin' | 'collaborator' | 'client';
export type PlatformUserRole = 'app_admin' | 'company_admin' | 'collaborator';
export type UserRole = LegacyUserRole | PlatformUserRole;
export type CollaboratorType = 'internal' | 'client';
export type Permission =
  | 'manage_platform'
  | 'manage_company'
  | 'manage_users'
  | 'manage_clients'
  | 'manage_catalog'
  | 'manage_settings'
  | 'create_budgets'
  | 'submit_budgets'
  | 'approve_budgets'
  | 'send_budgets'
  | 'view_reports'
  | 'manage_attachments';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  collaborator_type?: CollaboratorType;
  permissions?: Permission[];
  phone: string;
  avatar_url: string;
  job_title?: string;
  department?: string;
  nif?: string;
  address?: string;
  postal_code?: string;
  locality?: string;
  website?: string;
  company_id: string | null;
  active: boolean;
  created_at?: string;
}

// -------------------------------------------------------
// Companies
// -------------------------------------------------------
export interface Company {
  id: string;
  name: string;
  tax_id?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  sector?: string;
  notes?: string;
  active?: boolean;
  created_by?: string;
  created_at: string;
}

export interface CustomerType {
  id: string;
  company_id: string;
  name: string;
  default_margin: number;
  validity_days: number;
  max_discount: number;
  preferred_channels: CommunicationChannel[];
  payment_terms: string[];
  active: boolean;
  created_at?: string;
}

// -------------------------------------------------------
// Catalog
// -------------------------------------------------------
export interface CatalogItem {
  id: string;
  code: string;
  description: string;
  reference: string;
  brand: string;
  category: string;
  sector: string;
  unit: string;
  unit_cost: number;
  unitCost?: number;
  supplier: string;
  manufacturer?: string;
  model?: string;
  voltage?: string;
  current?: string;
  power?: string;
  dimensions?: string;
  weight?: string;
  certifications?: string;
  stock?: number;
  location?: string;
  notes?: string;
  is_custom?: boolean;
}

// -------------------------------------------------------
// Budgets
// -------------------------------------------------------
export type BudgetStatus =
  | 'rascunho'
  | 'pendente_aprovacao'
  | 'em_analise_tecnica'
  | 'enviado'
  | 'aprovado'
  | 'rejeitado'
  | 'pedido_alteracoes'
  | 'em_execucao'
  | 'aceite'
  | 'expirado'
  | 'concluido';

export interface BudgetItem {
  id?: string;
  budget_id?: string;
  code?: string;
  description?: string;
  reference?: string;
  brand?: string;
  category?: string;
  sector?: string;
  unit?: string;
  unit_cost?: number;
  unit_price?: number;
  quantity: number;
  margin?: number;
  discount?: number;
  notes?: string;
  sort_order?: number;
}

export interface CalculatedItem extends BudgetItem {
  pvp: number;
  finalPrice: number;
  subtotal: number;
  totalPrice: number;
}

export interface Budget {
  id: string;
  ref: string;
  name: string;
  company_id: string | null;
  company?: Company;
  client_profile_id?: string | null;
  customer_type_id?: string | null;
  version?: number;
  assigned_to: string | null;
  assignee?: Profile;
  status: BudgetStatus;
  sector: string;
  date: string;
  valid_until: string;
  notes: string;
  client_contact: string;
  client_email: string;
  include_tax: boolean;
  tax_rate: number;
  created_by?: string;
  creator?: Profile;
  created_at?: string;
  updated_at?: string;
  items?: BudgetItem[];
}

export type CommunicationChannel = 'email' | 'sms' | 'whatsapp' | 'portal';
export type TimelineVisibility = 'internal' | 'client' | 'both';
export type TimelineEventType =
  | 'created'
  | 'autosaved'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'expired'
  | 'message'
  | 'attachment'
  | 'version_created'
  | 'status_changed';

export interface BudgetTimelineEvent {
  id: string;
  budget_id: string;
  company_id: string;
  actor_id?: string | null;
  type: TimelineEventType;
  title: string;
  description?: string;
  visibility: TimelineVisibility;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface BudgetAttachment {
  id: string;
  budget_id: string;
  company_id: string;
  uploaded_by?: string | null;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  visibility: TimelineVisibility;
  created_at: string;
}

export interface CompanySettings {
  company_id: string;
  default_tax_rate: number;
  default_validity_days: number;
  default_margin: number;
  max_discount: number;
  send_channels: CommunicationChannel[];
  storage_limit_mb: number;
  modules: Record<string, boolean>;
}
