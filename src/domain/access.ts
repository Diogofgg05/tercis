import type { Profile } from '../types';
import { hasPermission } from './workflow';
import { canCreateBudget } from './budget-actions';

/** One source of truth for navigation visibility and client-side route gates.
 * Postgres RLS remains the authoritative permission enforcement. */
export type View = 'dashboard' | 'budgets' | 'editor' | 'viewer' | 'catalog' | 'companies' |
  'team' | 'reports' | 'settings' | 'chat' | 'access' | 'platform';

export const VIEW_LABELS: Record<View, string> = {
  dashboard: 'Visão geral', budgets: 'Orçamentos', editor: 'Editor de orçamento', viewer: 'Detalhe do orçamento',
  catalog: 'Catálogo', companies: 'Clientes', team: 'Equipa',
  reports: 'Relatórios', settings: 'Definições', chat: 'Mensagens',
  access: 'Perfis e permissões',
  platform:'Administração da plataforma',
};

export function canAccessView(profile: Profile | null | undefined, view: View): boolean {
  if (!profile || !profile.active) return false;
  switch(view) {
    case 'platform':return profile.platform_admin===true;
    case 'dashboard':
    case 'budgets':
    case 'viewer':
    case 'settings':
    case 'access':
      return true;
    case 'editor':
      return canCreateBudget(profile);
    case 'catalog':
      return hasPermission(profile, 'manage_catalog') || hasPermission(profile, 'create_budgets');
    case 'companies':
      return hasPermission(profile, 'manage_clients');
    case 'team':
      return profile.collaborator_type!=='client'&&['admin','company_admin','collaborator'].includes(profile.role);
    case 'reports':
      return hasPermission(profile, 'view_reports');
    case 'chat':
      return true; // The page explicitly marks messaging as unavailable until integrated.
    default:
      return false;
  }
}
