import { useEffect, useRef, useState } from 'react';
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

const sections = ['Principal', 'Gestão', 'Administração'] as const;

/** One responsive navigation surface: desktop rail + accessible mobile drawer.
 * This controls navigation visibility, not database authorization (RLS).
 */
export function Sidebar({ current, onChange, budgetCount = 0 }: Props) {
  const { profile, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('tercis:sidebar:compact') === 'true',
  );
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 1023px)').matches,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem('tercis:sidebar:compact', String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { setDrawerOpen(false); }, [current]);
  // React 18's JSX types don't expose the native inert attribute yet.
  // Set the DOM property to exclude the off-canvas drawer from keyboard focus.
  useEffect(()=>{
    if(asideRef.current)asideRef.current.inert=isMobile&&!drawerOpen;
  },[isMobile,drawerOpen]);

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(
        asideRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      ).filter(button => button.getClientRects().length > 0);
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen, isMobile]);

  const visible = entries.filter(entry => canAccessView(profile, entry.id));
  const initials = (profile?.full_name || 'T').trim().split(/\s+/)
    .slice(0, 2).map(word => word[0] || '').join('').toUpperCase();
  const activeView = current === 'editor' || current === 'viewer' ? 'budgets' : current;

  function closeDrawer(restoreFocus = false) {
    setDrawerOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }
  function navigate(target: View) {
    // Close the mobile drawer even when navigation is rejected by the parent
    // (for example due to unsaved changes in another view).
    closeDrawer(isMobile);
    onChange(target);
  }

  return <>
    <div className="tercis-mobile-nav-trigger lg:hidden">
      <button ref={triggerRef} type="button" aria-label="Abrir navegação"
        aria-controls="tercis-sidebar-drawer" aria-expanded={drawerOpen}
        aria-haspopup="dialog" onClick={() => setDrawerOpen(true)}
        className="tercis-mobile-nav-button">
        <Menu size={20} aria-hidden="true"/>
      </button>
    </div>

    {drawerOpen && isMobile && <button type="button" aria-label="Fechar menu"
      onClick={() => closeDrawer(true)}
      className="tercis-sidebar-backdrop"/>}

    <aside id="tercis-sidebar-drawer" ref={asideRef}
      role={isMobile && drawerOpen ? 'dialog' : undefined}
      aria-modal={isMobile && drawerOpen ? true : undefined}
      aria-label={isMobile && drawerOpen ? 'Navegação' : undefined}
      aria-hidden={isMobile && !drawerOpen ? true : undefined}
      data-collapsed={collapsed}
      data-open={drawerOpen}
      className={[
        'tercis-sidebar z-50 fixed lg:sticky top-0 h-dvh shrink-0 flex flex-col',
        'border-r border-slate-200 bg-white text-slate-800',
        'transition-[width,transform] duration-200',
        collapsed ? 'lg:w-[76px]' : 'lg:w-[248px]',
        drawerOpen ? 'translate-x-0 w-[252px]' : '-translate-x-full lg:translate-x-0 w-[252px]',
      ].join(' ')}>
      <div className="tercis-sidebar-brand border-b border-slate-200/80">
        <div className="tercis-brand-symbol" aria-hidden="true">T</div>
        <div className={'tercis-brand-copy min-w-0 flex-1 '+(collapsed?'lg:hidden':'')}>
          <strong className="block text-[15px] font-bold tracking-tight">Tercis</strong>
          <span className="block text-[10px] text-slate-500 font-medium">Workspace empresarial</span>
        </div>
        <button ref={closeRef} type="button" aria-label="Fechar navegação"
          onClick={() => closeDrawer(true)}
          className="tercis-sidebar-close lg:hidden">
          <X size={18} aria-hidden="true"/>
        </button>
      </div>

      <nav className="tercis-sidebar-nav flex-1 overflow-y-auto px-3 py-4"
        aria-label="Navegação principal">
        {sections.map(section => {
          const items = visible.filter(entry => entry.group === section);
          if (!items.length) return null;
          return <section key={section} className="tercis-sidebar-section"
            aria-label={section}>
            <p className={'tercis-sidebar-section-title '+(collapsed?'lg:sr-only':'')}>
              {section}
            </p>
            <div className="space-y-0.5">
              {items.map(({id,label,icon:Icon}) => {
                const active = activeView === id;
                return <button key={id} type="button" aria-label={label}
                  title={label} aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(id)}
                  className={'tercis-nav-link w-full flex items-center text-left gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ' +
                    (active ? 'tercis-nav-active bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
                  <Icon size={18} className="shrink-0" aria-hidden="true"/>
                  <span className={'truncate flex-1 '+(collapsed?'lg:sr-only':'')}>{label}</span>
                  {id === 'budgets' && budgetCount > 0 &&
                    <span aria-hidden="true" title="Orçamentos carregados"
                      className={'tercis-sidebar-count tabular-nums '+(collapsed?'lg:sr-only':'')}>
                      {budgetCount > 99 ? '99+' : budgetCount}
                    </span>}
                </button>;
              })}
            </div>
          </section>;
        })}
      </nav>

      <footer className="tercis-sidebar-footer border-t border-slate-200 p-3">
        <div className="tercis-sidebar-profile">
          <button type="button" aria-label="Abrir definições da conta"
            title="Definições da conta" onClick={() => navigate('settings')}
            className="tercis-sidebar-user">
            <span className="tercis-sidebar-avatar shrink-0" aria-hidden="true">{initials}</span>
            <span className={'tercis-sidebar-user-copy flex-1 min-w-0 '+(collapsed?'lg:sr-only':'')}>
              <strong className="block text-xs font-semibold truncate">{profile?.full_name || 'Utilizador'}</strong>
              <span className="block text-[10px] text-slate-500 truncate">
                {ROLE_LABELS[profile?.role || 'client']}
              </span>
            </span>
          </button>
          <button type="button" title="Terminar sessão" aria-label="Terminar sessão"
            onClick={() => {void signOut();}}
            className="tercis-sidebar-signout">
            <LogOut size={16} aria-hidden="true"/>
          </button>
        </div>
        <button type="button" title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!collapsed} aria-controls="tercis-sidebar-drawer"
          onClick={() => setCollapsed(value => !value)}
          className="tercis-sidebar-collapse hidden lg:flex">
          {collapsed ? <PanelLeft size={17} aria-hidden="true"/> :
            <><ChevronLeft size={16} aria-hidden="true"/> Recolher menu</>}
        </button>
      </footer>
    </aside>
  </>;
}
