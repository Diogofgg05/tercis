import { useMemo, useState } from 'react';
import { Copy, FileDown, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Budget, BudgetStatus, Company, Profile } from '../types';
import { formatCurrency, totalWithTax } from '../calc';

interface Props {
  budgets: Budget[];
  companies: Company[];
  team: Profile[];
  onNew: () => void;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  onDuplicate: (budget: Budget) => void;
  canCreate?: boolean;
  canDelete?: boolean;
}

const labels: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho', pendente_aprovacao: 'Pendente aprovação',
  em_analise_tecnica: 'Análise técnica', aprovado: 'Aprovado', enviado: 'Enviado',
  rejeitado: 'Rejeitado', pedido_alteracoes: 'Alterações', em_execucao: 'Em execução',
  aceite: 'Aceite', expirado: 'Expirado', concluido: 'Concluído',
};

function csvCell(value: string | number) {
  const valueText = String(value);
  const safe = /^[=+@\-\t\r]/.test(valueText) ? "'" + valueText : valueText;
  return '"' + safe.replaceAll('"', '""') + '"';
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

export function BudgetList({ budgets, onNew, onEdit, onDelete, onDuplicate, canCreate = true, canDelete = false }: Props) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BudgetStatus | 'todos'>('todos');
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-PT');
    return budgets
      .filter(b => (status === 'todos' || b.status === status) &&
        (!q || [b.ref, b.name, b.company?.name, b.sector].some(v => (v || '').toLocaleLowerCase('pt-PT').includes(q))))
      .sort((a,b) => (b.created_at || b.date || '').localeCompare(a.created_at || a.date || ''));
  }, [budgets, query, status]);

  return <div className="max-w-7xl mx-auto p-5 sm:p-8 lg:p-10 space-y-6">
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <p className="text-blue-700 text-xs font-bold tracking-[.15em] uppercase">Tercis / Documentos</p>
        <h1 className="text-3xl font-bold tracking-tight mt-2">Orçamentos</h1>
        <p className="text-sm text-slate-500 mt-2">{budgets.length} documentos · {filtered.length} resultados</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => downloadCsv(filtered)} disabled={!filtered.length} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-2"><FileDown size={16}/> Exportar CSV</button>
        {canCreate && <button type="button" onClick={onNew} className="px-4 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-blue-800"><Plus size={16}/> Novo orçamento</button>}
      </div>
    </header>

    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100">
        <label className="relative flex-1 block">
          <span className="sr-only">Pesquisar orçamentos</span>
          <Search size={17} className="absolute left-3 top-3 text-slate-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar referência, nome, cliente…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"/>
        </label>
        <label>
          <span className="sr-only">Filtrar estado</span>
          <select value={status} onChange={e=>setStatus(e.target.value as BudgetStatus | 'todos')} className="w-full sm:w-auto border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
            <option value="todos">Todos os estados</option>
            {Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>
      {!filtered.length ? <div className="text-center py-20 px-5">
        <FileText className="mx-auto text-slate-300 mb-4" size={32}/>
        <p className="font-semibold">{budgets.length ? 'Nenhum resultado' : 'Sem orçamentos'}</p>
        <p className="text-sm text-slate-500 mt-1">{budgets.length ? 'Altere os filtros.' : 'Crie o primeiro orçamento para começar.'}</p>
        {!budgets.length && canCreate && <button className="text-blue-700 font-semibold text-sm mt-5" onClick={onNew}>Criar orçamento</button>}
      </div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[750px] text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[11px]">
            <tr><th className="p-4">Orçamento</th><th className="p-4">Cliente</th><th className="p-4">Estado</th><th className="p-4">Data</th><th className="p-4 text-right">Total</th><th className="p-4 text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(b=><tr key={b.id} className="hover:bg-slate-50">
              <td className="p-4"><button onClick={()=>onEdit(b)} className="text-left font-semibold text-slate-900 hover:text-blue-700 block max-w-60 truncate">{b.name || 'Sem nome'}</button><small className="font-mono text-slate-500">{b.ref}</small></td>
              <td className="p-4 text-slate-600">{b.company?.name || '—'}</td>
              <td className="p-4"><span className="rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 text-xs font-semibold">{labels[b.status] || b.status}</span></td>
              <td className="p-4 text-slate-500">{b.date || '—'}</td>
              <td className="p-4 text-right font-semibold tabular-nums">{formatCurrency(totalWithTax(b, b.items || []))}</td>
              <td className="p-4"><div className="flex justify-end gap-1">
                <button aria-label={'Abrir ' + b.ref} title="Abrir" onClick={()=>onEdit(b)} className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg"><Pencil size={17}/></button>
                {canCreate && <button aria-label={'Duplicar ' + b.ref} title="Duplicar" onClick={()=>onDuplicate(b)} className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg"><Copy size={17}/></button>}
                {canDelete && <button aria-label={'Eliminar ' + b.ref} title="Eliminar" onClick={()=>onDelete(b.id)} className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg"><Trash2 size={17}/></button>}
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </section>
    <p className="text-xs text-slate-500">Os valores baseiam-se nos itens dos orçamentos; não representam faturação recebida. A exportação contém os registos filtrados.</p>
  </div>;
}
