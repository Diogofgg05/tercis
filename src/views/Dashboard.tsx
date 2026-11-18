import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { isClientUser } from '../domain/workflow';
import { ArrowRight, Building2, CheckCircle2, Clock3, FileText, Plus, TrendingUp } from 'lucide-react';
import { formatCurrency, totalWithTax } from '../calc';
import type { Budget, Company, BudgetStatus } from '../types';

interface Props {
  budgets: Budget[];
  companies: Company[];
  onNew: () => void;
  canCreate?: boolean;
  onOpen: (budget: Budget) => void;
  onShowBudgets?: () => void;
}

const statuses: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho', pendente_aprovacao: 'Pendente de aprovação',
  em_analise_tecnica: 'Em análise técnica', aprovado: 'Aprovado',
  enviado: 'Enviado', rejeitado: 'Rejeitado', pedido_alteracoes: 'Alterações',
  em_execucao: 'Em execução', aceite: 'Aceite', expirado: 'Expirado',
  concluido: 'Concluído',
};

type DashboardKpis = {
  quote_count:number;pending_count:number;approved_count:number;
  client_count:number;companies_count:number;quote_volume:number;
};

export function Dashboard({ budgets, companies, onNew, onOpen, onShowBudgets, canCreate = true }: Props) {
  const {profile,demoMode}=useAuth();
  const [serverKpis,setServerKpis]=useState<DashboardKpis|null>(null);
  const [kpiError,setKpiError]=useState(false);
  useEffect(()=>{
    if(demoMode||isClientUser(profile)){setServerKpis(null);return;}
    let alive=true;
    void supabase.rpc('tercis_dashboard_kpis').then(({data,error})=>{
      if(!alive)return;
      if(error || !data || typeof data.quote_count!=='number'){
        setKpiError(true);setServerKpis(null);return;
      }
      setKpiError(false);setServerKpis(data as DashboardKpis);
    });
    return ()=>{alive=false;};
  },[demoMode,profile?.id,budgets]);
  const { pending, approved, volume, recent, clients } = useMemo(() => {
    const pendingStatuses = new Set<BudgetStatus>(['rascunho','pendente_aprovacao','em_analise_tecnica','pedido_alteracoes']);
    return {
      pending: budgets.filter(b => pendingStatuses.has(b.status)).length,
      approved: budgets.filter(b => ['aprovado','aceite','concluido'].includes(b.status)).length,
      volume: budgets.reduce((sum, b) => sum + totalWithTax(b, b.items ?? []), 0),
      recent: [...budgets].sort((a,b) => (b.created_at || b.date || '').localeCompare(a.created_at || a.date || '')).slice(0,7),
      clients: new Set(budgets.map(b => b.company_id).filter(Boolean)).size,
    };
  }, [budgets]);

  // This operational breakdown is deliberately scoped to documents loaded in the browser.
  // Global KPIs above use the tenant-scoped server aggregate when available.
  const workflowBreakdown = [
    { label: 'Em preparação', count: budgets.filter(b =>
        ['rascunho','pedido_alteracoes','rejeitado'].includes(b.status)).length },
    { label: 'Em aprovação', count: budgets.filter(b =>
        ['pendente_aprovacao','em_analise_tecnica','aprovado'].includes(b.status)).length },
    { label: 'Enviados e aceites', count: budgets.filter(b =>
        ['enviado','aceite'].includes(b.status)).length },
    { label: 'Em execução ou concluídos', count: budgets.filter(b =>
        ['em_execucao','concluido'].includes(b.status)).length },
    { label: 'Expirados', count: budgets.filter(b => b.status === 'expirado').length },
  ];

  const stats = [
    { label: 'Orçamentos', value: String(serverKpis?.quote_count ?? budgets.length), icon: FileText, hint: 'Registados no sistema' },
    { label: 'A tratar', value: String(serverKpis?.pending_count ?? pending), icon: Clock3, hint: 'Aguardam ação' },
    { label: 'Aprovados', value: String(serverKpis?.approved_count ?? approved), icon: CheckCircle2, hint: 'Inclui aceites e concluídos' },
    { label: 'Volume orçamentado', value: formatCurrency(serverKpis ? Number(serverKpis.quote_volume) : volume), icon: TrendingUp, hint: 'Não representa faturação' },
  ];

  return (
    <div className="tercis-page space-y-4 text-slate-900">
      <header className="tercis-head">
        <div>
          <div className="tercis-eyebrow">TERCIS / PAINEL</div>
          <h1 className="tercis-title">Visão geral</h1>
          <p className="tercis-subtitle">Acompanhe propostas, aprovações e trabalho comercial num único local.</p>
        </div>
        {canCreate && <button type="button" onClick={onNew} className="tercis-button tercis-button-primary">
          <Plus size={18}/> Novo orçamento
        </button>}
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="tercis-stat">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">{label}</span>
              <span className="p-2 rounded-lg bg-blue-50 text-blue-700"><Icon size={17}/></span>
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight truncate" title={value}>{value}</div>
            <p className="mt-2 text-xs text-slate-400">{hint}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.7fr)] gap-4">
        <section className="tercis-card overflow-hidden">
          <div className="px-4 py-4 sm:px-5 flex flex-wrap justify-between items-center gap-3 border-b border-slate-100">
            <div><h2 className="font-bold text-[15px]">Orçamentos recentes</h2><p className="text-xs text-slate-500 mt-1">Documentos mais recentes disponíveis para consulta.</p></div>
            {onShowBudgets && <button type="button" onClick={onShowBudgets}
              className="tercis-button tercis-button-neutral">
              Ver todos <ArrowRight size={15}/>
            </button>}
          </div>
          {recent.length === 0 ? (
            <div className="p-10 text-center">
              <FileText size={28} className="mx-auto text-blue-300 mb-4"/>
              <h3 className="font-semibold">Ainda não existem orçamentos</h3>
              <p className="text-sm text-slate-500 mt-1">Crie o primeiro para começar a acompanhar o trabalho.</p>
              {canCreate && <button className="mt-5 text-blue-700 text-sm font-semibold hover:underline" onClick={onNew}>Criar orçamento</button>}
            </div>
          ) : <div className="divide-y divide-slate-100">
            {recent.map(b => <button key={b.id} type="button" onClick={() => onOpen(b)} className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50 focus-visible:bg-blue-50">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><FileText size={18}/></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{b.name || 'Sem designação'}</p>
                <p className="text-xs text-slate-500 mt-1 truncate">{b.ref} · {b.company?.name || 'Sem cliente associado'}</p>
              </div>
              <div className="hidden sm:block text-right">
                <p className="font-semibold text-sm">{formatCurrency(totalWithTax(b,b.items ?? []))}</p>
                <p className="text-xs text-slate-500 mt-1">{statuses[b.status] ?? b.status}</p>
              </div>
              <ArrowRight size={17} className="text-slate-400 shrink-0"/>
            </button>)}
          </div>}
        </section>
        <aside className="tercis-card p-4 sm:p-5">
          <span className="flex w-11 h-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Building2 size={21}/></span>
          <h2 className="font-bold text-lg mt-5">Clientes</h2>
          <p className="text-4xl font-bold tracking-tight mt-3">{serverKpis?.companies_count ?? companies.length}</p>
          <p className="text-sm text-slate-500 mt-2">Empresas ativas no catálogo</p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-sm">
            <span className="text-slate-500">Com orçamentos</span><strong>{serverKpis?.client_count ?? clients}</strong>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-[13px] font-bold text-slate-800">Estado das propostas</h3>
              <span className="text-[11px] text-slate-500">{budgets.length} carregadas</span>
            </div>
            <div className="space-y-3">
              {workflowBreakdown.map(stage => <div key={stage.label}>
                <div className="flex items-center justify-between text-[11px] gap-2 mb-1.5">
                  <span className="text-slate-600">{stage.label}</span>
                  <strong className="tabular-nums text-slate-800">{stage.count}</strong>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-blue-500 rounded-full" style={{
                    width: `${budgets.length ? stage.count / budgets.length * 100 : 0}%`,
                  }}/>
                </div>
              </div>)}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              Distribuição apenas dos documentos carregados nesta página, não de toda a base de dados.
            </p>
          </div>
        </aside>
      </div>
      <p className="text-xs text-slate-400">Os valores apresentados são estimativas dos orçamentos, não faturação confirmada.
        {!demoMode && !isClientUser(profile) && (kpiError || !serverKpis) &&
          ' Estatísticas provisórias baseadas apenas nos documentos carregados.'}
      </p>
    </div>
  );
}
