import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, Command, Search, WifiOff, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { canAccessView, VIEW_LABELS } from '../domain/access';
import type { View } from '../domain/access';

type Props = {
  current: View;
  onChange: (view: View) => void;
  online: boolean;
  demoMode: boolean;
};

const TARGETS: View[] = [
  'dashboard', 'budgets', 'companies', 'catalog', 'chat',
  'team', 'reports', 'access', 'settings',
];

/** Real navigation palette; only the pages authorized for the active profile
 * are shown. Permissions are still enforced by the database. */
export function WorkspaceTopbar({ current, onChange, online, demoMode }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const page = current === 'editor' || current === 'viewer' ? 'budgets' : current;
  const links = TARGETS.filter(target => canAccessView(profile, target));
  const results = links.filter(target => VIEW_LABELS[target]
    .toLocaleLowerCase('pt-PT')
    .includes(query.trim().toLocaleLowerCase('pt-PT')));

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuery('');
        setOpen(value => !value);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function navigate(target: View) {
    onChange(target);
    setOpen(false);
    setQuery('');
  }

  return <>
    <header className="tercis-topbar">
      <div className="tercis-topbar-trail" aria-label="Localização atual">
        <span className="hidden sm:inline text-slate-400">Área de trabalho</span>
        <ChevronRight aria-hidden="true" size={15} className="hidden sm:block text-slate-300"/>
        <span className="truncate font-semibold text-slate-800">{VIEW_LABELS[page]}</span>
      </div>
      <div className="tercis-topbar-actions">
        {!online && <span className="tercis-topbar-state text-amber-700"><WifiOff size={13}/> Sem rede</span>}
        {demoMode && <span className="tercis-topbar-demo">Demonstração</span>}
        <button type="button" className="tercis-search-trigger"
          onClick={() => { setQuery(''); setOpen(true); }}
          aria-label="Pesquisar páginas" aria-haspopup="dialog">
          <Search size={16} aria-hidden="true"/>
          <span className="hidden sm:inline">Ir para uma página</span>
          <kbd className="hidden md:inline">⌘ K</kbd>
        </button>
      </div>
    </header>

    {open && <div className="tercis-command-overlay" onMouseDown={event => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section role="dialog" aria-modal="true" aria-label="Navegar pelas páginas"
        className="tercis-command-panel">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Command aria-hidden="true" size={19} className="text-blue-600"/>
          <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && results.length) navigate(results[0]); }}
            placeholder="Pesquisar páginas…"
            aria-label="Pesquisar páginas"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-900"/>
          <button type="button" aria-label="Fechar pesquisa" onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={17}/></button>
        </div>
        <div className="p-2 max-h-[min(60vh,400px)] overflow-y-auto">
          {results.length ? results.map(target => <button key={target} type="button"
            onClick={() => navigate(target)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 focus-visible:bg-blue-50">
            <span className="flex-1 font-medium">{VIEW_LABELS[target]}</span>
            {target === page ? <span className="text-[11px] text-blue-700">Atual</span> : <ArrowRight size={15} aria-hidden="true"/>}
          </button>) : <p role="status" className="px-3 py-7 text-center text-sm text-slate-500">Nenhuma página encontrada.</p>}
        </div>
        <p className="px-4 py-2.5 border-t border-slate-100 text-[11px] text-slate-500">
          Enter para abrir o primeiro resultado · Esc para fechar
        </p>
      </section>
    </div>}
  </>;
}
