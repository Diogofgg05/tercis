import { useMemo, useState } from 'react';
import { Archive, Copy, Eye, FileDown, FileText, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import type { Budget, BudgetStatus, Company, Profile } from '../types';
import { formatCurrency, totalWithTax } from '../calc';
import { StatusBadge } from '../components/StatusBadge';
import { STATUS_LABELS as labels } from '../domain/workflow';

interface Props {
  budgets: Budget[];
  companies: Company[];
  team: Profile[];
  onNew: () => void;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  onDuplicate: (budget: Budget) => void;
  canCreate?: boolean;
  canDelete?: (budget: Budget) => boolean;
  canDuplicate?: (budget: Budget) => boolean;
  canEdit?: (budget: Budget) => boolean;
  canArchive?: boolean;
  onArchive?: (budget: Budget, archive: boolean) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onExportAll?: () => Promise<void>;
  searchQuery?: string;
  onSearchQuery?: (query: string) => void;
  selectedStatus?: BudgetStatus|'todos';
  onSelectedStatus?: (status: BudgetStatus|'todos') => void;
  archivedOnly?: boolean;
  onArchivedOnly?: (archived: boolean) => void;
}

function csvCell(value: string | number) {
  const valueText = String(value);
  // Excel/LibreOffice can interpret formula prefixes even after leading spaces.
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(valueText) ? "'" + valueText : valueText;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export type CsvBudgetRow={
  ref:string;name:string;company:string;status:BudgetStatus;
  date:string;valid_until:string;amount:number;
};
export function downloadCompleteCsv(rows:CsvBudgetRow[]) {
  const contents: (string|number)[][]=[
    ['Referência','Nome','Cliente','Estado','Data','Válido até','Total (EUR)'],
    ...rows.map(row=>[
      row.ref,row.name,row.company||'',labels[row.status]||row.status,
      row.date||'',row.valid_until||'',Number(row.amount).toFixed(2),
    ]),
  ];
  const csv='\uFEFF'+contents.map(r=>r.map(csvCell).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='tercis-orcamentos-completos.csv';link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function downloadCsv(items: Budget[]) {
  const rows: (string | number)[][] = [
    ['Referência','Nome','Cliente','Estado','Data','Válido até','Total (EUR)'],
    ...items.map(b => [b.ref, b.name, b.company?.name || '', labels[b.status] || b.status, b.date, b.valid_until, totalWithTax(b,b.items || []).toFixed(2)]),
  ];
  const csv = '\uFEFF' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tercis-orcamentos.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function BudgetList({ budgets, team, onNew, onEdit, onDelete, onDuplicate, canCreate = true, canDelete = () => false, canDuplicate = () => false, canEdit = () => false, canArchive = false, onArchive, hasMore = false, onLoadMore, onExportAll, searchQuery, onSearchQuery, selectedStatus, onSelectedStatus, archivedOnly, onArchivedOnly }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BudgetStatus | 'todos'>('todos');
  const [showArchived, setShowArchived] = useState(false);
  const [exporting,setExporting]=useState(false);
  const [exportError,setExportError]=useState('');
  const activeQuery = searchQuery ?? query;
  const activeStatus = selectedStatus ?? status;
  const activeArchived = archivedOnly ?? showArchived;
  const teamNames = useMemo(() => new Map(team.map(member => [member.id, member.full_name])), [team]);
  const hasFilters = Boolean(activeQuery.trim()) || activeStatus !== 'todos' || activeArchived;
  function clearFilters() {
    (onSearchQuery || setQuery)('');
    (onSelectedStatus || setStatus)('todos');
    (onArchivedOnly || setShowArchived)(false);
  }
  const filtered = useMemo(() => {
    const q = activeQuery.trim().toLocaleLowerCase('pt-PT');
    return budgets
      .filter(b => Boolean(b.archived_at) === activeArchived && (activeStatus === 'todos' || b.status === activeStatus) &&
        (!q || [b.ref, b.name, b.company?.name, b.sector].some(v => (v || '').toLocaleLowerCase('pt-PT').includes(q))))
      .sort((a,b) => (b.created_at || b.date || '').localeCompare(a.created_at || a.date || ''));
  }, [budgets, activeQuery, activeStatus, activeArchived]);

  return <div className="tercis-page space-y-4">
    <header className="tercis-head">
      <div>
        <p className="tercis-eyebrow">Tercis / Documentos</p>
        <h1 className="tercis-title">Orçamentos</h1>
        <p className="text-sm text-slate-500 mt-2" aria-live="polite">{filtered.length} nesta página · {budgets.length} carregados</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => {
          if(!onExportAll){downloadCsv(filtered);return;}
          setExportError('');setExporting(true);
          void onExportAll().catch(error=>{
            setExportError(error instanceof Error?error.message:'Falha ao exportar orçamento.');
          }).finally(()=>setExporting(false));
        }} disabled={exporting||(!onExportAll&&!filtered.length)}
          className="tercis-button tercis-button-neutral disabled:opacity-40 inline-flex items-center gap-2">
          <FileDown size={16}/>{exporting?'A exportar…':onExportAll?'Exportar CSV completo':'Exportar CSV'}
        </button>
        {canCreate && <button type="button" onClick={onNew} className="tercis-button tercis-button-primary inline-flex items-center gap-2 hover:bg-blue-800"><Plus size={16}/> Novo orçamento</button>}
      </div>
    </header>

    {exportError && <p role="alert" className="tercis-note text-rose-700">{exportError}</p>}
        <section className="tercis-card overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 p-3 sm:p-4 border-b border-slate-100">
        <label className="relative flex-1 block">
          <span className="sr-only">Pesquisar orçamentos</span>
          <Search size={17} className="absolute left-3 top-3 text-slate-400"/>
          <input value={activeQuery} onChange={e => (onSearchQuery || setQuery)(e.target.value)} placeholder="Pesquisar referência, nome, cliente…"
            className="tercis-input pl-10 pr-3 text-sm"/>
        </label>
        <label>
          <span className="sr-only">Filtrar estado</span>
          <select value={activeStatus} onChange={e=>(onSelectedStatus || setStatus)(e.target.value as BudgetStatus | 'todos')} className="tercis-input w-full sm:w-auto text-sm">
            <option value="todos">Todos os estados</option>
            {Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="inline-flex gap-2 items-center text-sm text-slate-700">
          <input type="checkbox" checked={activeArchived}
            onChange={event=>(onArchivedOnly || setShowArchived)(event.target.checked)}/>
          Mostrar arquivo
        </label>
        {hasFilters && <button type="button" onClick={clearFilters}
          className="text-xs font-semibold text-blue-700 hover:underline self-start sm:self-auto">
          Limpar filtros
        </button>}
      </div>
      {!filtered.length ? <div className="text-center py-12 px-5">
        <FileText className="mx-auto text-slate-300 mb-4" size={32}/>
        <p className="font-semibold">{budgets.length ? 'Nenhum resultado' : 'Sem orçamentos'}</p>
        <p className="text-sm text-slate-500 mt-1">{budgets.length ? 'Altere os filtros.' : 'Crie o primeiro orçamento para começar.'}</p>
        {!budgets.length && canCreate && <button className="text-blue-700 font-semibold text-sm mt-5" onClick={onNew}>Criar orçamento</button>}
      </div> : <>
        <div className="tercis-mobile-budget divide-y divide-slate-100 md:hidden">
          {filtered.map(b => <article key={b.id} className="p-4 space-y-3">
            <div className="flex gap-3 items-start justify-between">
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onEdit(b)}
                  className="block text-left text-sm font-bold text-slate-900 break-words hover:text-blue-700">
                  {b.name || 'Sem nome'}
                </button>
                <p className="font-mono text-[11px] text-slate-500 mt-1">{b.ref}</p>
              </div>
              <StatusBadge status={b.status} size="sm"/>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="min-w-0">
                <span className="block text-slate-500 mb-1">Cliente</span>
                <span className="block font-semibold text-slate-800 truncate">{b.company?.name || 'Não associado'}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Total estimado</span>
                <strong className="text-sm tabular-nums text-slate-900">{formatCurrency(totalWithTax(b,b.items || []))}</strong>
              </div>
              <div className="min-w-0">
                <span className="block text-slate-500 mb-1">Responsável</span>
                <span className="block text-slate-800 truncate">{teamNames.get(b.assigned_to ?? '') || '—'}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Data</span>
                <span className="text-slate-800">{b.date || '—'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => onEdit(b)}
                className="tercis-button tercis-button-neutral"><Eye size={15}/> {canEdit(b) ? 'Editar' : 'Consultar'}</button>
              {canDuplicate(b) && <button type="button" onClick={() => onDuplicate(b)}
                className="tercis-button tercis-button-neutral"><Copy size={15}/> Duplicar</button>}
              {canArchive && onArchive && <button type="button" onClick={() => onArchive(b,!b.archived_at)}
                className="tercis-button tercis-button-neutral">
                {b.archived_at ? <RotateCcw size={15}/> : <Archive size={15}/>}
                {b.archived_at ? 'Recuperar' : 'Arquivar'}
              </button>}
              {canDelete(b) && <button type="button" onClick={() => onDelete(b.id)}
                className="tercis-button text-rose-700 hover:bg-rose-50"><Trash2 size={15}/> Eliminar</button>}
            </div>
          </article>)}
        </div>
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[11px]">
            <tr><th scope="col" className="p-4">Orçamento</th><th scope="col" className="p-4">Cliente</th><th scope="col" className="p-4">Responsável</th><th scope="col" className="p-4">Estado</th><th scope="col" className="p-4">Data</th><th scope="col" className="p-4 text-right">Total</th><th scope="col" className="p-4 text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(b=><tr key={b.id} className="hover:bg-slate-50">
              <td className="p-4"><button onClick={()=>onEdit(b)} className="text-left font-semibold text-slate-900 hover:text-blue-700 block max-w-60 truncate">{b.name || 'Sem nome'}</button><small className="font-mono text-slate-500">{b.ref}</small></td>
              <td className="p-4 text-slate-600">{b.company?.name || '—'}</td>
              <td className="p-4 text-slate-600">{teamNames.get(b.assigned_to ?? '') || '—'}</td>
              <td className="p-4"><StatusBadge status={b.status} size="sm"/></td>
              <td className="p-4 text-slate-500">{b.date || '—'}</td>
              <td className="p-4 text-right font-semibold tabular-nums">{formatCurrency(totalWithTax(b, b.items || []))}</td>
              <td className="p-4"><div className="flex justify-end gap-1">
                <button aria-label={'Abrir ' + b.ref} title={canEdit(b)?'Editar':'Consultar'} onClick={()=>onEdit(b)} className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg">{canEdit(b)?<Pencil size={17}/>:<Eye size={17}/>}</button>
                {canDuplicate(b) && <button aria-label={'Duplicar ' + b.ref} title="Duplicar" onClick={()=>onDuplicate(b)} className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg"><Copy size={17}/></button>}
                {canDelete(b) && <button aria-label={'Eliminar ' + b.ref} title="Eliminar" onClick={()=>onDelete(b.id)} className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg"><Trash2 size={17}/></button>}
                {canArchive && onArchive && <button
                  aria-label={(b.archived_at ? 'Recuperar ' : 'Arquivar ') + b.ref}
                  title={b.archived_at ? 'Recuperar do arquivo' : 'Arquivar'}
                  onClick={()=>onArchive(b,!b.archived_at)}
                  className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg">
                  {b.archived_at ? <RotateCcw size={17}/> : <Archive size={17}/>}
                </button>}
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div></>}
    </section>
    {hasMore && onLoadMore && <div className="flex justify-center">
      <button type="button" className="tercis-button tercis-button-neutral" onClick={onLoadMore}>
        Carregar mais 100 orçamentos
      </button></div>}
    <p className="text-xs text-slate-500">Os valores baseiam-se nos itens atualmente carregados; não representam faturação recebida. A exportação em modo real consulta todos os documentos autorizados pelos filtros (máximo de 5000); a demonstração exporta os registos visíveis.</p>
  </div>;
}
