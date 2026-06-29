/*
  Foundation for the multi-company budget workflow.

  Adds:
  - app/company admin roles and collaborator type
  - fine-grained permissions
  - customer types and company settings
  - richer budget statuses and versioning
  - timeline, attachments, messages and audit logs
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS collaborator_type text NOT NULL DEFAULT 'internal'
    CHECK (collaborator_type IN ('internal', 'client')),
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customer_type_id uuid;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('app_admin','company_admin','admin','collaborator','client'));

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS storage_limit_mb int NOT NULL DEFAULT 1024,
  ADD COLUMN IF NOT EXISTS modules jsonb NOT NULL DEFAULT '{"budgets": true, "catalog": true, "client_portal": true}'::jsonb;

CREATE TABLE IF NOT EXISTS company_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  default_tax_rate numeric(5,2) NOT NULL DEFAULT 23,
  default_validity_days int NOT NULL DEFAULT 30,
  default_margin numeric(8,2) NOT NULL DEFAULT 30,
  max_discount numeric(8,2) NOT NULL DEFAULT 20,
  send_channels text[] NOT NULL DEFAULT ARRAY['email','portal'],
  payment_terms text[] NOT NULL DEFAULT ARRAY['Transferencia bancaria'],
  quote_templates jsonb NOT NULL DEFAULT '[]'::jsonb,
  integrations jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS customer_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_margin numeric(8,2) NOT NULL DEFAULT 30,
  validity_days int NOT NULL DEFAULT 30,
  max_discount numeric(8,2) NOT NULL DEFAULT 20,
  preferred_channels text[] NOT NULL DEFAULT ARRAY['email','portal'],
  payment_terms text[] NOT NULL DEFAULT ARRAY['Transferencia bancaria'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE customer_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_customer_type_fk
  FOREIGN KEY (customer_type_id) REFERENCES customer_types(id) ON DELETE SET NULL;

ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS client_profile_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS customer_type_id uuid REFERENCES customer_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text DEFAULT '';

ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_status_check;
ALTER TABLE budgets
  ADD CONSTRAINT budgets_status_check
  CHECK (status IN (
    'rascunho',
    'pendente_aprovacao',
    'em_analise_tecnica',
    'aprovado',
    'enviado',
    'rejeitado',
    'pedido_alteracoes',
    'em_execucao',
    'aceite',
    'expirado',
    'concluido'
  ));

CREATE TABLE IF NOT EXISTS budget_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(budget_id, version)
);

CREATE TABLE IF NOT EXISTS budget_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  type text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client','both')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_timeline_budget_idx
  ON budget_timeline_events (budget_id, created_at DESC);

CREATE TABLE IF NOT EXISTS budget_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','client','both')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  channel text NOT NULL DEFAULT 'portal' CHECK (channel IN ('email','sms','whatsapp','portal')),
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'both' CHECK (visibility IN ('internal','client','both')),
  external_id text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  ip_address inet,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read company settings"
  ON company_settings FOR SELECT TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('app_admin','admin')
  );

CREATE POLICY "Company admins manage company settings"
  ON company_settings FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','admin','app_admin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','admin','app_admin'));

CREATE POLICY "Company members read customer types"
  ON customer_types FOR SELECT TO authenticated
  USING (
    company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('app_admin','admin')
  );

CREATE POLICY "Company admins manage customer types"
  ON customer_types FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','admin','app_admin'))
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','admin','app_admin'));

CREATE POLICY "Timeline mirrors budget access"
  ON budget_timeline_events FOR SELECT TO authenticated
  USING (budget_id IN (SELECT id FROM budgets));

CREATE POLICY "Internal users insert timeline"
  ON budget_timeline_events FOR INSERT TO authenticated
  WITH CHECK (
    budget_id IN (SELECT id FROM budgets)
    AND (SELECT collaborator_type FROM profiles WHERE id = auth.uid()) = 'internal'
  );

CREATE POLICY "Attachments mirror budget access"
  ON budget_attachments FOR SELECT TO authenticated
  USING (budget_id IN (SELECT id FROM budgets));

CREATE POLICY "Messages mirror budget access"
  ON budget_messages FOR SELECT TO authenticated
  USING (budget_id IN (SELECT id FROM budgets));

CREATE POLICY "Audit readable by admins"
  ON audit_logs FOR SELECT TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('app_admin','company_admin','admin'));
