import type { BudgetStatus, Permission, Profile, UserRole } from '../types';

export const STATUS_LABELS: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho',
  pendente_aprovacao: 'Pendente de aprovação',
  em_analise_tecnica: 'Em análise técnica',
  aprovado: 'Aprovado',
  enviado: 'Enviado',
  rejeitado: 'Rejeitado',
  pedido_alteracoes: 'Pedido de alterações',
  em_execucao: 'Em execução',
  aceite: 'Aceite',
  expirado: 'Expirado',
  concluido: 'Concluído',
};

export const STATUS_FLOW: Record<BudgetStatus, BudgetStatus[]> = {
  rascunho: ['pendente_aprovacao'],
  pendente_aprovacao: ['aprovado', 'rejeitado', 'pedido_alteracoes'],
  em_analise_tecnica: ['aprovado', 'rejeitado', 'pedido_alteracoes'],
  aprovado: ['enviado', 'em_execucao'],
  enviado: ['aceite', 'rejeitado', 'pedido_alteracoes', 'expirado'],
  rejeitado: ['rascunho'],
  pedido_alteracoes: ['rascunho'],
  em_execucao: ['concluido'],
  aceite: ['em_execucao', 'concluido'],
  expirado: ['rascunho'],
  concluido: [],
};

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  app_admin: ['manage_platform', 'view_reports'],
  company_admin: [
    'manage_company',
    'manage_users',
    'manage_clients',
    'manage_catalog',
    'manage_settings',
    'create_budgets',
    'submit_budgets',
    'approve_budgets',
    'send_budgets',
    'view_reports',
    'manage_attachments',
  ],
  collaborator: ['create_budgets', 'submit_budgets', 'manage_attachments'],
  admin: [
    'manage_company',
    'manage_users',
    'manage_clients',
    'manage_catalog',
    'manage_settings',
    'create_budgets',
    'submit_budgets',
    'approve_budgets',
    'send_budgets',
    'view_reports',
    'manage_attachments',
  ],
  client: [],
};

export function permissionsFor(profile?: Profile | null): Permission[] {
  if (!profile) return [];
  return Array.from(new Set([...(ROLE_PERMISSIONS[profile.role] ?? []), ...(profile.permissions ?? [])]));
}

export function hasPermission(profile: Profile | null | undefined, permission: Permission): boolean {
  return permissionsFor(profile).includes(permission);
}

export function isCompanyAdmin(profile?: Profile | null): boolean {
  return profile?.role === 'company_admin' || profile?.role === 'admin';
}

export function isAppAdmin(profile?: Profile | null): boolean {
  return profile?.role === 'app_admin';
}

export function isClientUser(profile?: Profile | null): boolean {
  return profile?.role === 'client' || profile?.collaborator_type === 'client';
}

export function canTransitionBudget(profile: Profile | null | undefined, from: BudgetStatus, to: BudgetStatus): boolean {
  if (!STATUS_FLOW[from]?.includes(to)) return false;
  if (to === 'pendente_aprovacao') return hasPermission(profile, 'submit_budgets');
  if (['aprovado', 'rejeitado', 'pedido_alteracoes'].includes(to)) return hasPermission(profile, 'approve_budgets') || isClientUser(profile);
  if (to === 'enviado') return hasPermission(profile, 'send_budgets');
  if (to === 'aceite') return isClientUser(profile);
  return true;
}

export function nextBudgetStatuses(profile: Profile | null | undefined, current: BudgetStatus): BudgetStatus[] {
  return (STATUS_FLOW[current] ?? []).filter((status) => canTransitionBudget(profile, current, status));
}
