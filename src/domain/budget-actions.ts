import type { Budget, Profile } from '../types';

/** UI only; all operations must also be enforced in PostgreSQL. */
const editableStatuses = new Set<Budget['status']>([
  'rascunho', 'rejeitado', 'pedido_alteracoes', 'expirado',
]);

export function canCreateBudget(profile: Profile | null | undefined): boolean {
  return !!profile?.active && profile.collaborator_type !== 'client'
    && (profile.role === 'admin' || profile.role === 'company_admin' || profile.role === 'collaborator');
}
export function canWorkOnBudget(profile: Profile | null | undefined, budget: Budget): boolean {
  if (!canCreateBudget(profile) || !profile) return false;
  if (profile.role === 'admin' || profile.role === 'company_admin')
    return (profile.organization_id ?? null)===(budget.organization_id ?? null);
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
  if (!profile?.active || budget.status !== 'rascunho' || budget.sent_at != null || budget.archived_at != null) return false;
  return profile.role === 'admin' || (profile.role === 'company_admin'
    && budget.created_by === profile.id) || (profile.role === 'collaborator'
    && profile.collaborator_type !== 'client' && budget.created_by === profile.id);
}
export function canChangeBudgetAssignment(profile: Profile | null | undefined): boolean {
  return profile?.active === true && (profile.role === 'admin' || profile.role === 'company_admin');
}
