import { useMemo, useState } from 'react';
import { BarChart3, Building2, FileText, TrendingUp } from 'lucide-react';
import { totalWithTax, formatCurrency } from '../calc';
import { STATUS_LABELS } from '../domain/workflow';
import { StatusBadge } from '../components/StatusBadge';
import type { Budget, BudgetStatus, Company, Profile } from '../types';

type Props = { budgets: Budget[]; companies: Company[]; team: Profile[] };
const monthFormatter = new Intl.DateTimeFormat('pt-PT',{month:'short'});
const periodDate = (date:string) => {
  const parsed=new Date((date||'').slice(0,10)+'T12:00:00Z');
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export function ReportsView({budgets,companies,team}:Props) {
  const [period,setPeriod] = useState<6|12>(6);
  const [status,setStatus] = useState<BudgetStatus|'all'>('all');
  const [companyId,setCompanyId] = useState('all');

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

  const maxMonth=Math.max(1,...summary.months.map(m=>m.value));
  const ranked=[...summary.byCompany.entries()]
    .sort((a,b)=>b[1].value-a[1].value).slice(0,6);

  return <div className="tercis-page space-y-5">
    <header className="tercis-head">
      <div><p className="tercis-eyebrow">Tercis / Analytics</p>
        <h1 className="tercis-title">Relatórios</h1>
        <p className="tercis-subtitle">Análise de orçamentos registados — não representa faturação.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <select value={period} onChange={e=>setPeriod(Number(e.target.value) as 6|12)} aria-label="Período" className="tercis-input w-auto">
          <option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option>
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value as typeof status)} aria-label="Estado" className="tercis-input w-auto">
          <option value="all">Todos os estados</option>
          {Object.entries(STATUS_LABELS).map(([key,label])=><option value={key} key={key}>{label}</option>)}
        </select>
        <select value={companyId} onChange={e=>setCompanyId(e.target.value)} aria-label="Empresa" className="tercis-input w-auto max-w-40">
          <option value="all">Todos os clientes</option>
          {companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
      </div>
    </header>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        {title:'Orçamentos',value:String(summary.filtered.length),icon:FileText,subtitle:'No conjunto filtrado'},
        {title:'Volume orçamentado',value:formatCurrency(summary.value),icon:TrendingUp,subtitle:'IVA conforme cada documento'},
        {title:'Clientes',value:String(summary.byCompany.size),icon:Building2,subtitle:'Com orçamentos associados'},
        {title:'Equipa',value:String(team.filter(member=>member.active).length),icon:BarChart3,subtitle:'Perfis ativos visíveis'},
      ].map(({title,value,icon:Icon,subtitle})=><article key={title} className="tercis-stat">
        <div className="flex justify-between items-center gap-2 text-slate-500 text-[11px] font-semibold">
          {title}<Icon size={16} className="text-blue-600"/>
        </div><div className="text-[clamp(17px,2vw,25px)] font-bold tracking-tight mt-3 truncate" title={value}>{value}</div>
        <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
      </article>)}
    </div>

    <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)] gap-3">
      <section className="tercis-card overflow-hidden">
        <div className="tercis-card-header"><h2 className="tercis-card-title">Evolução mensal</h2>
          <p className="text-[11px] text-slate-500 mt-1">Valores de orçamento pela data do documento</p>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex gap-2 items-end h-[205px]">
            {summary.months.map(month=><div key={month.key} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-2">
              <div title={month.key+' · '+formatCurrency(month.value)} className="w-full max-w-12 h-[169px] flex items-end rounded-md bg-[#f3f6fa] overflow-hidden">
                <div className="w-full rounded-md bg-blue-500" style={{height:month.value>0?Math.max(5,month.value/maxMonth*100)+'%':'0%'}}/>
              </div>
              <div className="text-[10px] text-slate-500 capitalize">{month.label}</div>
            </div>)}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex gap-5">
            <span>Meses selecionados: {period}</span><span>Orçamentos datados: {summary.months.reduce((n,m)=>n+m.count,0)}</span>
          </div>
        </div>
      </section>
      <section className="tercis-card overflow-hidden">
        <div className="tercis-card-header"><h2 className="tercis-card-title">Por estado</h2>
          <p className="text-[11px] text-slate-500 mt-1">Distribuição dos documentos filtrados</p></div>
        <div className="p-4 space-y-3">
          {summary.byStatus.size===0 ? <p className="text-xs text-slate-500 py-6 text-center">Sem dados para os filtros selecionados.</p> :
            [...summary.byStatus.entries()].sort((a,b)=>b[1].count-a[1].count).map(([key,value])=><div key={key}>
              <div className="flex justify-between items-center gap-2 mb-1.5">
                <StatusBadge status={key} size="sm"/><span className="text-xs font-semibold tabular-nums">{value.count}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{width:Math.max(3,value.count/Math.max(1,summary.filtered.length)*100)+'%'}}/>
              </div>
            </div>)}
        </div>
      </section>
    </div>
    <section className="tercis-card overflow-hidden">
      <div className="tercis-card-header"><h2 className="tercis-card-title">Clientes por volume de orçamento</h2>
        <p className="text-[11px] text-slate-500 mt-1">Montantes estimados, não receitas recebidas</p></div>
      {!ranked.length ? <p className="p-8 text-center text-sm text-slate-500">Ainda não há orçamentos para analisar.</p> :
        <div className="overflow-x-auto"><table className="tercis-table">
          <thead><tr><th>Cliente</th><th>Orçamentos</th><th className="text-right">Valor orçamentado</th></tr></thead>
          <tbody>{ranked.map(([id,data])=><tr key={id}>
            <td className="font-semibold text-slate-700">{companies.find(c=>c.id===id)?.name||'Sem cliente associado'}</td>
            <td className="text-slate-600 tabular-nums">{data.count}</td>
            <td className="text-right font-semibold tabular-nums">{formatCurrency(data.value)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </div>;
}
