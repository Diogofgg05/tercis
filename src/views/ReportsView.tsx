import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { BarChart3, Building2, FileText, TrendingUp } from 'lucide-react';
import { totalWithTax, formatCurrency } from '../calc';
import { STATUS_LABELS } from '../domain/workflow';
import { StatusBadge } from '../components/StatusBadge';
import { WorkspaceFilterBar, WorkspaceEmptyState } from '../components/WorkspacePrimitives';
import type { Budget, BudgetStatus, Company, Profile } from '../types';

type Props = { budgets: Budget[]; companies: Company[]; team: Profile[]; partial?: boolean };
const monthFormatter = new Intl.DateTimeFormat('pt-PT',{month:'short'});
const periodDate = (date:string) => {
  const parsed=new Date((date||'').slice(0,10)+'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export function ReportsView({budgets,companies,team,partial=false}:Props) {
  const [period,setPeriod] = useState<6|12>(6);
  const [chartMetric,setChartMetric] = useState<'value'|'count'>('value');
  const [status,setStatus] = useState<BudgetStatus|'all'>('all');
  const [companyId,setCompanyId] = useState('all');
  const {demoMode,profile}=useAuth();
  type ReportData={
    count:number;value:number;client_count:number;
    months:{key:string;count:number;value:number}[];
    by_status:{status:BudgetStatus;count:number;value:number}[];
    by_company:{company_id:string|null;count:number;value:number}[];
  };
  const [serverData,setServerData]=useState<ReportData|null>(null);
  const [serverError,setServerError]=useState('');
  const [serverLoading,setServerLoading]=useState(false);
  useEffect(()=>{
    if(demoMode){setServerData(null);setServerError('');return;}
    let active=true;
    setServerLoading(true);setServerData(null);setServerError('');
    void Promise.resolve(supabase.rpc('tercis_report_summary',{
      p_months:period,p_status:status==='all'?'':status,
      p_company_id:companyId==='all'?null:companyId,
    })).then(({data,error})=>{
      if(!active)return;
      if(error||!data||!Array.isArray(data.months)||
        !Array.isArray(data.by_status)||!Array.isArray(data.by_company)){
        setServerError(error?.message||'Resposta inválida dos relatórios.');
      }else{
        setServerData({
          count:Number(data.count||0),value:Number(data.value||0),
          client_count:Number(data.client_count||0),
          months:data.months.map((v:{key:string;count:number;value:number})=>({
            key:v.key,count:Number(v.count),value:Number(v.value),
          })),
          by_status:data.by_status.map((v:{status:BudgetStatus;count:number;value:number})=>({
            status:v.status,count:Number(v.count),value:Number(v.value),
          })),
          by_company:data.by_company.map((v:{company_id:string|null;count:number;value:number})=>({
            company_id:v.company_id,count:Number(v.count),value:Number(v.value),
          })),
        });
      }
    }).catch(reason=>{
      if(active)setServerError(reason instanceof Error?reason.message:'Falha de ligação aos relatórios.');
    }).finally(()=>{if(active)setServerLoading(false);});
    return ()=>{active=false;};
  },[demoMode,profile?.id,period,status,companyId]);

  const summary = useMemo(() => {
    // The period selector must apply to KPIs and rankings, not just the chart.
    const today=new Date();
    const periodStart=new Date(today.getFullYear(),today.getMonth()-(period-1),1);
    const periodEnd=new Date(today.getFullYear(),today.getMonth()+1,1);
    const filtered=budgets.filter(b=>{
      const date=periodDate(b.date||b.created_at||'');
      return (status==='all'||b.status===status) &&
        (companyId==='all'||b.company_id===companyId) &&
        date!==null && date>=periodStart && date<periodEnd;
    });
    const months=Array.from({length:period},(_,i)=>{
      const d=new Date(today.getFullYear(),today.getMonth()-(period-1-i),1);
      const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      return {key,label:monthFormatter.format(d),count:0,value:0};
    });
    const bucket=new Map(months.map(m=>[m.key,m]));
    const byStatus=new Map<BudgetStatus,{count:number;value:number}>();
    const byCompany=new Map<string,{count:number;value:number}>();
    for(const budget of filtered) {
      const value=totalWithTax(budget,budget.items||[]);
      const date=periodDate(budget.date||budget.created_at||'');
      const key=date ? date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0') : '';
      const month=bucket.get(key);
      if(month){month.count++;month.value+=value;}
      const s=byStatus.get(budget.status)||{count:0,value:0};
      s.count++;s.value+=value;byStatus.set(budget.status,s);
      const company=budget.company_id||'none';
      const entry=byCompany.get(company)||{count:0,value:0};
      entry.count++;entry.value+=value;byCompany.set(company,entry);
    }
    return {filtered,months,byStatus,byCompany,
      value:filtered.reduce((sum,b)=>sum+totalWithTax(b,b.items||[]),0)};
  },[budgets,companyId,period,status]);

  const report=serverData ? {
    filtered:[] as Budget[],
    months:serverData.months.map(month=>({
      ...month,label:monthFormatter.format(new Date(month.key+'-15T12:00:00Z')),
    })),
    byStatus:new Map(serverData.by_status.map(v=>[v.status,{count:v.count,value:v.value}] as const)),
    byCompany:new Map(serverData.by_company.map(v=>[v.company_id||'none',{count:v.count,value:v.value}] as const)),
    value:serverData.value,
    count:serverData.count,
    clients:serverData.client_count,
  } : {
    ...summary,count:summary.filtered.length,clients:summary.byCompany.size,
  };
  const maxMonth=Math.max(1,...report.months.map(m=>chartMetric==='value'?m.value:m.count));
  const ranked=[...report.byCompany.entries()]
    .sort((a,b)=>b[1].value-a[1].value).slice(0,6);

  return <div className="tercis-page space-y-5">
    {!demoMode && (serverLoading||serverError||!serverData) && <p role="status" className="tercis-note">
      {serverLoading?'A calcular relatório completo no servidor…':serverError
        ?'Relatório do servidor indisponível: '+serverError+'. Os valores locais podem estar incompletos.'
        :'A validar resultados do servidor.'}
    </p>}
    {(!serverData && partial) && <p role="status" className="tercis-note">Relatório parcial: existem mais orçamentos no servidor. Estes gráficos incluem apenas os documentos carregados.</p>}
    <header className="tercis-head">
      <div><p className="tercis-eyebrow">Tercis / Analytics</p>
        <h1 className="tercis-title">Relatórios</h1>
        <p className="tercis-subtitle">Análise de propostas — não representa faturação nem receitas recebidas.</p>
      </div>
    </header>

    <div className="tercis-card overflow-hidden">
      <WorkspaceFilterBar>
        <div className="tercis-filterbar-select">
          <label htmlFor="report-period" className="tercis-form-label">Período</label>
          <select id="report-period" value={period}
            onChange={e=>setPeriod(Number(e.target.value) as 6|12)} className="tercis-input mt-1">
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </div>
        <div className="tercis-filterbar-select">
          <label htmlFor="report-status" className="tercis-form-label">Estado</label>
          <select id="report-status" value={status}
            onChange={e=>setStatus(e.target.value as typeof status)} className="tercis-input mt-1">
            <option value="all">Todos os estados</option>
            {Object.entries(STATUS_LABELS).map(([key,label])=><option value={key} key={key}>{label}</option>)}
          </select>
        </div>
        <div className="tercis-filterbar-select">
          <label htmlFor="report-company" className="tercis-form-label">Cliente</label>
          <select id="report-company" value={companyId}
            onChange={e=>setCompanyId(e.target.value)} className="tercis-input mt-1">
            <option value="all">Todos os clientes</option>
            {companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </div>
        {(status!=='all'||companyId!=='all'||period!==6) && <button type="button"
          onClick={()=>{setPeriod(6);setStatus('all');setCompanyId('all');}}
          className="tercis-button tercis-button-neutral self-end">Limpar filtros</button>}
      </WorkspaceFilterBar>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        {title:'Orçamentos',value:String(report.count),icon:FileText,subtitle:'No conjunto filtrado'},
        {title:'Volume orçamentado',value:formatCurrency(report.value),icon:TrendingUp,subtitle:'IVA conforme cada documento'},
        {title:'Clientes',value:String(report.clients),icon:Building2,subtitle:'Com orçamentos associados'},
        {title:'Equipa',value:String(team.filter(member=>member.active).length),icon:BarChart3,subtitle:'Perfis ativos visíveis'},
      ].map(({title,value,icon:Icon,subtitle})=><article key={title} className="tercis-stat">
        <div className="flex justify-between items-center gap-2 text-slate-500 text-[11px] font-semibold">
          {title}<Icon size={16} className="text-blue-600"/>
        </div><div className="text-[clamp(17px,2vw,25px)] font-bold tracking-tight mt-3 truncate" title={value}>{value}</div>
        <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
      </article>)}
    </div>

    <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)] gap-3 items-start">
      <section className="tercis-card overflow-hidden">
        <div className="tercis-card-header flex flex-wrap gap-3 items-center justify-between">
          <div><h2 className="tercis-card-title">Evolução mensal</h2>
            <p className="text-[11px] text-slate-500 mt-1">Valores e quantidade por mês de emissão</p>
          </div>
          <div className="inline-flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50"
            role="group" aria-label="Métrica do gráfico">
            <button type="button" aria-pressed={chartMetric==='value'}
              onClick={()=>setChartMetric('value')}
              className={'px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors '+(chartMetric==='value'?'bg-white text-blue-700 shadow-sm':'text-slate-500 hover:text-slate-900')}>
              Valor (€)
            </button>
            <button type="button" aria-pressed={chartMetric==='count'}
              onClick={()=>setChartMetric('count')}
              className={'px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors '+(chartMetric==='count'?'bg-white text-blue-700 shadow-sm':'text-slate-500 hover:text-slate-900')}>
              Quantidade
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex gap-2 items-end h-[205px]">
            {report.months.map(month=><div key={month.key} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-2">
              <div role="img" aria-label={month.key+' · '+(chartMetric==='value'?formatCurrency(month.value):month.count+' orçamentos')}
                title={month.key+' · '+(chartMetric==='value'?formatCurrency(month.value):month.count+' orçamentos')}
                className="w-full max-w-12 h-[169px] flex items-end rounded-lg bg-[#f1f5fa] overflow-hidden">
                <div className="w-full rounded-md bg-blue-500" style={{height:(chartMetric==='value'?month.value:month.count)>0
                  ?Math.max(5,(chartMetric==='value'?month.value:month.count)/maxMonth*100)+'%':'0%'}}/>
              </div>
              <div className="text-[10px] text-slate-500 capitalize">{month.label}</div>
            </div>)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex gap-5">
            <span>Meses selecionados: {period}</span><span>Orçamentos datados: {report.months.reduce((n,m)=>n+m.count,0)}</span>
          </div>
        </div>
      </section>
      <section className="tercis-card overflow-hidden">
        <div className="tercis-card-header"><h2 className="tercis-card-title">Por estado</h2>
          <p className="text-[11px] text-slate-500 mt-1">Distribuição dos documentos filtrados</p></div>
        <div className="p-4 space-y-3">
          {report.byStatus.size===0 ? <p className="text-xs text-slate-500 py-6 text-center">Sem dados para os filtros selecionados.</p> :
            [...report.byStatus.entries()].sort((a,b)=>b[1].count-a[1].count).map(([key,value])=><div key={key}>
              <div className="flex justify-between items-center gap-2 mb-1.5">
                <StatusBadge status={key} size="sm"/><span className="text-xs font-semibold tabular-nums">{value.count}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{width:Math.max(3,value.count/Math.max(1,report.count)*100)+'%'}}/>
              </div>
            </div>)}
        </div>
      </section>
    </div>
    <section className="tercis-card overflow-hidden">
      <div className="tercis-card-header"><h2 className="tercis-card-title">Clientes por volume de orçamento</h2>
        <p className="text-[11px] text-slate-500 mt-1">Montantes estimados, não receitas recebidas</p></div>
      {!ranked.length ? <WorkspaceEmptyState title="Ainda não existem valores a analisar"
          description="Ajuste os filtros ou adicione orçamentos para preencher este relatório."
          icon={<BarChart3 size={23}/>}/> :
        <>
          <div className="md:hidden divide-y divide-slate-100">
            {ranked.map(([id,data])=><article key={id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[12px] font-semibold text-slate-800 break-words">
                    {companies.find(company=>company.id===id)?.name||'Sem cliente associado'}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">{data.count} orçamentos</p>
                </div>
                <strong className="text-[13px] tabular-nums text-slate-900 whitespace-nowrap">{formatCurrency(data.value)}</strong>
              </div>
            </article>)}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="tercis-table">
              <thead><tr><th>Cliente</th><th>Orçamentos</th><th className="text-right">Valor orçamentado</th></tr></thead>
              <tbody>{ranked.map(([id,data])=><tr key={id}>
                <td className="font-semibold text-slate-700">{companies.find(c=>c.id===id)?.name||'Sem cliente associado'}</td>
                <td className="text-slate-600 tabular-nums">{data.count}</td>
                <td className="text-right font-semibold tabular-nums">{formatCurrency(data.value)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </>}
    </section>
  </div>;
}
