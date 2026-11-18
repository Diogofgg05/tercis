import type { Budget, Profile } from '../types';

/** UI only; all operations must also be enforced in PostgreSQL RLS/triggers. */
const editableStatuses = new Set<Budget['status']>([
  'rascunho', 'rejeitado', 'pedido_alteracoes', 'expirado',
]);

export function canCreateBudget(profile: Profile | null | undefined): boolean {
  return !!profile?.active && profile.collaborator_type !== 'client'
    && (profile.role === 'admin' || profile.role === 'company_admin' || profile.role === 'collaborator');
}

/** Never authorize a cross-tenant action merely because the actor created or
 * was assigned to the target. Legacy demo records have no tenant on either side. */
function sameOrganization(profile: Profile, budget: Budget): boolean {
  const actorTenant = profile.organization_id ?? null;
  const budgetTenant = budget.organization_id ?? null;
  return actorTenant === budgetTenant;
}

export function canWorkOnBudget(profile: Profile | null | undefined, budget: Budget): boolean {
  if (!canCreateBudget(profile) || !profile || !sameOrganization(profile, budget)) return false;
  if (profile.role === 'admin' || profile.role === 'company_admin') return true;
  return budget.created_by === profile.id || budget.assigned_to === profile.id;
}

export function canEditBudget(profile: Profile | null | undefined, budget: Budget): boolean {
  return !budget.archived_at && canWorkOnBudget(profile, budget) && editableStatuses.has(budget.status)
    && !(budget.sent_at && budget.status !== 'rascunho');
}

export function canDuplicateBudget(profile: Profile | null | undefined, budget: Budget): boolean {
  return canWorkOnBudget(profile, budget);
}

export function canDeleteBudget(profile: Profile | null | undefined, budget: Budget): boolean {
  if (!canWorkOnBudget(profile, budget) || !profile
      || budget.status !== 'rascunho' || budget.sent_at != null || budget.archived_at != null) {
    return false;
  }
  return profile.role === 'admin' || (
    (profile.role === 'company_admin' || profile.role === 'collaborator')
    && budget.created_by === profile.id
  );
}

export function canChangeBudgetAssignment(profile: Profile | null | undefined): boolean {
  return profile?.active === true && (profile.role === 'admin' || profile.role === 'company_admin');
}
