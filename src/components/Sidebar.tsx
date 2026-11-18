import { useEffect, useState } from 'react';
import {
  BarChart3, BookOpen, Building2, ChevronLeft, FileText, LayoutDashboard,
  LogOut, Menu, MessageSquare, PanelLeft, Settings, ShieldCheck, Users, X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { canAccessView } from '../domain/access';
import type { View } from '../domain/access';
import type { UserRole } from '../types';

export type { View } from '../domain/access';

type Props = {
  current: View;
  onChange: (view: View) => void;
  budgetCount?: number;
  messageCount?: number;
};

const ROLE_LABELS: Record<UserRole, string> = {
  app_admin: 'Administração da plataforma',
  company_admin: 'Administração da empresa',
  admin: 'Administrador legado',
  collaborator: 'Colaborador',
  client: 'Cliente',
};

const entries = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard, group: 'Principal' },
  { id: 'budgets', label: 'Orçamentos', icon: FileText, group: 'Principal' },
  { id: 'companies', label: 'Clientes', icon: Building2, group: 'Gestão' },
  { id: 'catalog', label: 'Catálogo', icon: BookOpen, group: 'Gestão' },
  { id: 'chat', label: 'Mensagens', icon: MessageSquare, group: 'Gestão' },
  { id: 'team', label: 'Equipa', icon: Users, group: 'Administração' },
  { id: 'reports', label: 'Relatórios', icon: BarChart3, group: 'Administração' },
  { id: 'access', label: 'Perfis e acessos', icon: ShieldCheck, group: 'Administração' },
  { id: 'settings', label: 'Definições', icon: Settings, group: 'Administração' },
] as const satisfies ReadonlyArray<{ id: View; label: string; icon: typeof FileText; group: string }>;

export function Sidebar({ current, onChange, budgetCount = 0 }: Props) {
  const { profile, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tercis:sidebar:compact') === 'true');
  useEffect(() => { localStorage.setItem('tercis:sidebar:compact', String(collapsed)); }, [collapsed]);
  useEffect(() => { setDrawerOpen(false); }, [current]);

  const sections = ['Principal', 'Gestão', 'Administração'] as const;
  const visible = entries.filter(entry => canAccessView(profile, entry.id));
  const initials = (profile?.full_name || 'T').split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();

  return <>
    <div className="lg:hidden fixed z-40 top-3 left-3">
      <button type="button" aria-label="Abrir navegação" onClick={() => setDrawerOpen(true)}
        className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm text-slate-700"><Menu size={20}/></button>
    </div>
    {drawerOpen && <button type="button" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)}
      className="fixed inset-0 bg-slate-950/40 z-40 lg:hidden"/>}
    <aside className={[
      'tercis-sidebar z-50 fixed lg:sticky top-0 h-dvh shrink-0 flex flex-col border-r border-slate-200 bg-white text-slate-800 transition-[width,transform] duration-200',
      collapsed ? 'lg:w-[76px]' : 'lg:w-[248px]',
      drawerOpen ? 'translate-x-0 w-[252px]' : '-translate-x-full lg:translate-x-0 w-[252px]',
    ].join(' ')}>
      <div className="flex items-center gap-3 h-[66px] min-h-[66px] px-4 border-b border-slate-200/80">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-[#1673e6] flex items-center justify-center text-white font-black text-lg tracking-tight">T</div>
        <div className={'min-w-0 flex-1 '+(collapsed?'lg:hidden':'')}>
          <div className="font-bold text-[15px] tracking-tight">Tercis</div>
          <div className="text-[10px] text-slate-500 font-medium">Workspace empresarial</div>
        </div>
        <button type="button" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)}
          className="lg:hidden ml-auto p-1 rounded-lg hover:bg-slate-200"><X size={18}/></button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4" aria-label="Navegação principal">
        {sections.map(section => {
          const items = visible.filter(entry => entry.group === section);
          if (!items.length) return null;
          return <div key={section}>
            <p className={'px-2 mb-1.5 text-[10px] font-bold tracking-[.09em] uppercase text-slate-400 '+(collapsed?'lg:sr-only':'')}>{section}</p>
            <div className="space-y-0.5">
              {items.map(({id,label,icon:Icon}) => {
                const active = current === id || (id === 'budgets' && current === 'editor');
                return <button key={id} type="button" title={label} aria-current={active ? 'page' : undefined}
                  onClick={() => {onChange(id); setDrawerOpen(false);}}
                  className={'tercis-nav-link w-full flex items-center text-left gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ' +
                    (active ? 'tercis-nav-active bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
                  <Icon size={18} className="shrink-0"/>
                  <span className={'truncate flex-1 '+(collapsed?'lg:sr-only':'')}>{label}</span>
                  {id === 'budgets' && budgetCount > 0 && <span className={'text-[10px] text-slate-500 tabular-nums '+(collapsed?'lg:sr-only':'')}>{budgetCount}</span>}
                </button>;
              })}
            </div>
          </div>;
        })}

      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2 rounded-xl px-1 py-2">
          <div className="h-9 w-9 rounded-full bg-slate-200 border border-white grid place-items-center text-slate-700 font-bold text-xs shrink-0">{initials}</div>
          <div className={'flex-1 min-w-0 '+(collapsed?'lg:hidden':'')}>
            <div className="text-xs font-semibold truncate">{profile?.full_name || 'Utilizador'}</div>
            <div className="text-[10px] text-slate-500 truncate">{ROLE_LABELS[profile?.role || 'client']}</div>
          </div>
          <button type="button" onClick={() => {void signOut();}} title="Terminar sessão" aria-label="Terminar sessão" className="text-slate-500 hover:bg-slate-200 p-2 rounded-lg"><LogOut size={16}/></button>
        </div>
        <button type="button" title={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          onClick={() => setCollapsed(value => !value)}
          className="hidden lg:flex items-center justify-center w-full rounded-lg mt-1 py-2 text-slate-500 hover:bg-slate-200 gap-2 text-xs">
          {collapsed ? <PanelLeft size={16}/> : <><ChevronLeft size={15}/> Recolher menu</>}
        </button>
      </div>
    </aside>
  </>;
}
