import { useState } from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { BudgetAttachments } from '../components/BudgetAttachments';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import { QuoteEmailDelivery } from '../components/QuoteEmailDelivery';
import { nextBudgetStatuses, STATUS_LABELS } from '../domain/workflow';
import { calcItem, formatCurrency, grandTotal, totalWithTax } from '../calc';
import type { Budget, BudgetStatus } from '../types';

type Props={
  budget:Budget;onBack:()=>void;onTransition:(status:BudgetStatus)=>Promise<void>;transitionBusy?:boolean;
};

export function BudgetDetail({budget,onBack,onTransition,transitionBusy=false}:Props) {
  const {profile} = useAuth();
  const [error,setError]=useState('');
  const [pendingStatus,setPendingStatus]=useState<BudgetStatus|null>(null);
  const [changing,setChanging]=useState(false);
  const allowed=nextBudgetStatuses(profile,budget.status)
    .filter(() => !budget.archived_at)
    .filter(to => !(['aceite','rejeitado','pedido_alteracoes'].includes(to) && budget.can_respond === false));
  const lines=(budget.items||[]).map(calcItem);
  const net=grandTotal(lines);
  const gross=totalWithTax(budget,lines);
  async function applyStatus(){
    if(!pendingStatus || !allowed.includes(pendingStatus) || changing || transitionBusy)return;
    setChanging(true);setError('');
    try {
      await onTransition(pendingStatus);
      setPendingStatus(null);
    } catch(reason){
      setError(reason instanceof Error?reason.message:'Não foi possível mudar o estado.');
    } finally {setChanging(false);}
  }
  return <div className="tercis-page space-y-4">
    <header className="tercis-head">
      <div><p className="tercis-eyebrow">Tercis / Orçamentos / {budget.ref}</p>
        <h1 className="tercis-title">{budget.name||'Orçamento'}</h1>
        <p className="tercis-subtitle">Visualização de consulta · versão {budget.version||1}</p></div>
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={budget.status}/>
        <button onClick={onBack} className="tercis-button tercis-button-neutral"><ArrowLeft size={15}/> Voltar</button>
      </div>
    </header>

    {budget.can_respond === false && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Esta é uma versão publicada para consulta histórica. Não é possível aceitá-la, rejeitá-la ou pedir alterações depois de ser substituída.</p>}
    {error && <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">{error}</p>}

    <BudgetAttachments budget={budget} />
    <QuoteEmailDelivery budget={budget} />

    <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(270px,.6fr)] gap-3">
      <section className="tercis-card overflow-hidden">
        <div className="tercis-card-header"><h2 className="tercis-card-title">Itens do orçamento</h2>
          <p className="text-[11px] text-slate-500 mt-1">Valores finais por artigo, antes de eventual IVA</p></div>
        {lines.length===0 ? <p className="text-slate-500 text-sm p-8">Este orçamento ainda não tem itens.</p> :
          <div className="overflow-x-auto"><table className="tercis-table min-w-[590px]">
            <thead><tr><th>Descrição</th><th>Quantidade</th><th>Preço unitário</th><th className="text-right">Subtotal</th></tr></thead>
            <tbody>{lines.map((item,i)=><tr key={item.id||i}>
              <td><div className="font-semibold text-slate-900">{item.description||'Sem descrição'}</div>
                <p className="text-[11px] text-slate-500">{item.reference||item.code||''}</p></td>
              <td className="tabular-nums">{item.quantity} {item.unit||'un'}</td>
              <td className="tabular-nums">{formatCurrency(item.finalPrice)}</td>
              <td className="text-right font-semibold tabular-nums">{formatCurrency(item.subtotal)}</td>
            </tr>)}</tbody>
          </table></div>}
        <div className="p-4 border-t border-slate-100 space-y-2 max-w-md ml-auto">
          <div className="flex justify-between text-xs text-slate-600"><span>Subtotal</span><span>{formatCurrency(net)}</span></div>
          {budget.include_tax && <div className="flex justify-between text-xs text-slate-600"><span>IVA ({budget.tax_rate}%)</span><span>{formatCurrency(gross-net)}</span></div>}
          <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-100"><span>Total</span><span>{formatCurrency(gross)}</span></div>
        </div>
      </section>
      <aside className="space-y-3">
        <section className="tercis-card p-4 space-y-3">
          <h2 className="tercis-card-title">Detalhes</h2>
          {[
            ['Referência',budget.ref],
            ['Cliente',budget.company?.name||'Não associado'],
            ['Data',budget.date||'—'],
            ['Válido até',budget.valid_until||'—'],
            ['Estado',STATUS_LABELS[budget.status]],
          ].map(([label,value])=><div key={label} className="flex justify-between gap-3 text-xs border-b border-slate-100 pb-2 last:border-0">
            <span className="text-slate-500">{label}</span><span className="text-right font-medium">{value}</span>
          </div>)}
        </section>
        <section className="tercis-card p-4 space-y-3">
          <h2 className="tercis-card-title">Fluxo de aprovação</h2>
          {allowed.length===0 ? <p className="text-xs text-slate-500">Não há transições disponíveis para o teu papel neste estado.</p> :
            <div className="flex flex-wrap gap-2">{allowed.map(to=>
              <button type="button" key={to} disabled={transitionBusy} onClick={()=>setPendingStatus(to)}
                className="tercis-button tercis-button-neutral">{STATUS_LABELS[to]}</button>)}
            </div>}
          <p className="text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck size={14} className="shrink-0 mt-0.5"/>Mudanças de estado em contas reais são verificadas e auditadas pelo servidor.</p>
        </section>
        {budget.notes && <section className="tercis-card p-4">
          <h2 className="tercis-card-title">Notas da proposta</h2>
          <p className="text-xs text-slate-600 leading-5 mt-2 whitespace-pre-wrap">{budget.notes}</p></section>}
      </aside>
    </div>
    <ConfirmActionDialog open={pendingStatus!==null}
      onClose={()=>setPendingStatus(null)} busy={changing||transitionBusy}
      title="Confirmar alteração de estado"
      description="Esta ação será registada na proposta e poderá afetar o acesso do cliente."
      confirmLabel="Alterar estado"
      onConfirm={()=>{void applyStatus();}}>
      <p className="text-slate-600">
        Estado atual: <strong>{STATUS_LABELS[budget.status]}</strong>
      </p>
      <p className="mt-2 text-slate-600">
        Novo estado: <strong>{pendingStatus?STATUS_LABELS[pendingStatus]:''}</strong>
      </p>
    </ConfirmActionDialog>
    <p className="text-xs text-slate-500 flex items-start gap-2"><FileText size={14} className="mt-0.5 shrink-0"/>
      Esta vista apresenta apenas os itens e valores comerciais; os custos e margens internos não são exibidos.</p>
  </div>;
}
