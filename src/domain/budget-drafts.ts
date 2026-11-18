import type { Budget, Profile } from '../types';

/** Use local calendar dates to avoid UTC midnight changing the displayed day. */
function localDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function quoteDates(now: Date): { date: string; valid_until: string } {
  const valid = new Date(now);
  valid.setDate(valid.getDate() + 30);
  return { date: localDate(now), valid_until: localDate(valid) };
}

/** New unsaved drafts use the authenticated tenant for frontend permission checks.
 * PostgreSQL RLS and triggers still verify organization ownership on INSERT. */
export function createBudgetDraft(
  profile: Profile, id: string, ref: string, now: Date = new Date(),
): Budget {
  return {
    id, ref, name: '',
    organization_id: profile.organization_id ?? undefined,
    company_id: null,
    assigned_to: profile.id,
    status: 'rascunho',
    sector: 'Eletricidade Industrial',
    ...quoteDates(now),
    notes: '', client_contact: '', client_email: '',
    include_tax: false, tax_rate: 23,
    created_by: profile.id, version: 1, items: [],
  };
}

/** A duplicate must never inherit the original publication and archive state. */
export function duplicateBudgetDraft(
  source: Budget,
  profile: Profile,
  id: string,
  ref: string,
  newItemId: () => string,
  now: Date = new Date(),
): Budget {
  const manager = profile.role === 'admin' || profile.role === 'company_admin';
  return {
    ...source,
    id, ref, name: `${source.name} (cópia)`,
    organization_id: profile.organization_id ?? undefined,
    company_id: manager ? source.company_id : null,
    company: manager ? source.company : undefined,
    assigned_to: manager ? source.assigned_to : profile.id,
    assignee: undefined,
    creator: undefined,
    client_profile_id: manager ? (source.client_profile_id ?? null) : null,
    customer_type_id: manager ? (source.customer_type_id ?? null) : null,
    client_contact: manager ? source.client_contact : '',
    client_email: manager ? source.client_email : '',
    ...quoteDates(now),
    status: 'rascunho',
    sent_at: null, archived_at: null, archived_by: null,
    can_respond: false, version: 1,
    created_by: profile.id,
    created_at: undefined, updated_at: undefined,
    items: (source.items ?? []).map(item => ({
      ...item, id: newItemId(), budget_id: undefined,
    })),
  };
}
