import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Building2, FileText, Mail, MapPin, Pencil, Phone, Plus,
  Search, SlidersHorizontal, Users, X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { hasPermission } from '../domain/workflow';
import { supabase } from '../lib/supabase';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { FormSection, FormGrid, FormField } from '../components/FormLayout';
import { WorkspaceEmptyState, WorkspaceFilterBar } from '../components/WorkspacePrimitives';
import type { Budget, Company } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, totalWithTax } from '../calc';
import { formatDatePt } from '../lib/formatDate';
import { BusinessLinksPanel } from '../components/BusinessLinksPanel';

type Props = {
  companies: Company[];
  budgets: Budget[];
  onRefresh: () => void | Promise<void>;
  onOpenBudget?: (budget: Budget) => void;
  onOpenInternalNotes?: (budgetId:string) => void;
  onSeeBudgets?: (companyName: string) => void;
};
type Fields = {
  name:string;city:string;sector:string;email:string;phone:string;
  tax_id:string;address:string;website:string;notes:string;
};
const blank:Fields = {
  name:'',city:'',sector:'',email:'',phone:'',
  tax_id:'',address:'',website:'',notes:'',
};

export function CompaniesView({ companies, budgets, onRefresh, onOpenBudget, onOpenInternalNotes, onSeeBudgets }: Props) {
  const { profile, demoMode } = useAuth();
  const canManage = !demoMode && (profile?.role === 'admin' || profile?.role === 'company_admin') && hasPermission(profile, 'manage_clients');
  const [query, setQuery] = useState('');
  const [sectorFilter,setSectorFilter] = useState('all');
  const [sort,setSort] = useState<'name'|'recent'|'quotes'>('name');
  const [detailId,setDetailId] = useState<string|null>(null);
  const [detailTab,setDetailTab] = useState<'overview'|'quotes'>('overview');
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState<Fields>(blank);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverCounts,setServerCounts] = useState<Record<string,number>|null>(null);
  useEffect(()=>{
    if(demoMode){setServerCounts(null);return;}
    let active=true;
    void supabase.rpc('tercis_company_budget_counts').then(({data,error:failure})=>{
      if(!active)return;
      if(failure||!Array.isArray(data)){setServerCounts(null);return;}
      setServerCounts(Object.fromEntries(data.map((row:{company_id:string;quote_count:number})=>
        [row.company_id,Number(row.quote_count)])));
    });
    return ()=>{active=false;};
  },[demoMode,profile?.id,companies]);

  const counts=useMemo(()=>{
    const result=new Map<string,number>();
    for(const budget of budgets)if(budget.company_id){
      result.set(budget.company_id,(result.get(budget.company_id)||0)+1);
    }
    return result;
  },[budgets]);
  const countFor=(id:string)=>serverCounts?.[id]??counts.get(id)??0;
  const sectorOptions=useMemo(()=>[...new Set(companies.map(c=>c.sector||'').filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'pt-PT')),[companies]);
  const filtered = useMemo(() => {
    const q=query.toLocaleLowerCase('pt-PT').trim();
    return [...companies].filter(company=>
      (sectorFilter==='all'||company.sector===sectorFilter)&&
      (!q||[company.name,company.city,company.sector,company.email,company.phone,company.tax_id]
        .some(value=>(value||'').toLocaleLowerCase('pt-PT').includes(q))))
      .sort((first,second)=>sort==='quotes'
        ?countFor(second.id)-countFor(first.id)||first.name.localeCompare(second.name,'pt-PT')
        :sort==='recent'
          ?(second.created_at||'').localeCompare(first.created_at||'')
          :first.name.localeCompare(second.name,'pt-PT'));
  },[companies,query,sectorFilter,sort,serverCounts,counts]);
  const detailCompany=companies.find(company=>company.id===detailId)??null;
  const detailBudgets=useMemo(()=>budgets
    .filter(budget=>budget.company_id===detailId)
    .sort((first,second)=>(second.created_at||second.date||'')
      .localeCompare(first.created_at||first.date||'')),
    [budgets,detailId]);
  function openDetails(company:Company){
    setDetailId(company.id);
    setDetailTab('overview');
    setError(null);
  }

  function open(company: Company | null) {
    setSelected(company);
    setForm(company ? {
      name: company.name, city: company.city || '', sector: company.sector || '',
      email: company.email || '', phone: company.phone || '',
      tax_id:company.tax_id||'',address:company.address||'',
      website:company.website||'',notes:company.notes||'',
    } : blank);
    setError(null);
    setIsOpen(true);
  }

  async function save() {
    if (!canManage || !profile) return;
    const name = form.name.trim();
    if (!name) { setError('Indique o nome do cliente.'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Introduza um endereço de email válido.'); return;
    }
    const website=form.website.trim();
    if(website){
      try {
        const parsed=new URL(website);
        if(!['http:','https:'].includes(parsed.protocol))throw new Error('unsupported');
      }catch{
        setError('Introduza um website válido com https:// ou http://.');
        return;
      }
    }
    if(form.notes.length>2000){setError('As notas não podem ultrapassar 2000 caracteres.');return;}
    setSaving(true);
    setError(null);
    try {
      const fields = {
        name, city:form.city.trim(), sector:form.sector.trim(),
        email:form.email.trim().toLowerCase(), phone:form.phone.trim(),
        tax_id:form.tax_id.trim(),address:form.address.trim(),
        website,notes:form.notes.trim(),
      };
      const result = selected
        ? await supabase.from('companies').update(fields).eq('id',selected.id).select('id').single()
        : await supabase.from('companies').insert({ ...fields, created_by:profile.id }).select('id').single();
      if (result.error) throw result.error;
      setIsOpen(false);
      try {
        await onRefresh();
      } catch {
        // A successful write must not be reported as a failed write.
        setError('Cliente guardado. A lista não atualizou devido a uma falha de ligação.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível guardar este cliente.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="tercis-page space-y-4">
    <header className="tercis-head">
      <div>
        <p className="tercis-eyebrow">Tercis / CRM</p>
        <h1 className="tercis-title">Clientes</h1>
        <p className="tercis-subtitle mt-2">{companies.length} clientes autorizados na organização</p>
      </div>
      {canManage && <button onClick={()=>open(null)} className="tercis-button tercis-button-primary inline-flex items-center gap-2"><Plus size={17}/> Novo cliente</button>}
    </header>

    {demoMode && <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">Modo demonstração: os clientes apresentados são exemplos. A edição está desativada.</p>}
    {error && !isOpen && <p role="status" className="tercis-note">{error}</p>}

    <BusinessLinksPanel companies={companies}/>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="tercis-stat"><div className="text-[11px] text-slate-500">Clientes</div>
        <strong className="block mt-1 text-[23px] tracking-tight tabular-nums">{companies.length}</strong></div>
      <div className="tercis-stat"><div className="text-[11px] text-slate-500">Com email</div>
        <strong className="block mt-1 text-[23px] tracking-tight tabular-nums">
          {companies.filter(c=>Boolean(c.email)).length}</strong></div>
      <div className="tercis-stat col-span-2 sm:col-span-1"><div className="text-[11px] text-slate-500">Setores identificados</div>
        <strong className="block mt-1 text-[23px] tracking-tight tabular-nums">{sectorOptions.length}</strong></div>
    </div>
    <div className="tercis-card overflow-hidden">
      <WorkspaceFilterBar count={`${filtered.length} clientes`}>
        <label className="tercis-filterbar-search">
          <Search size={16} className="absolute top-[13px] left-3 text-slate-400"/>
          <span className="sr-only">Pesquisar clientes</span>
          <input className="tercis-input pl-9" type="search"
            placeholder="Pesquisar empresa, setor, localidade ou email…"
            value={query} onChange={event=>setQuery(event.target.value)}/>
        </label>
        <label className="tercis-filterbar-select">
          <span className="sr-only">Filtrar por setor</span>
          <select aria-label="Filtrar por setor" value={sectorFilter}
            onChange={e=>setSectorFilter(e.target.value)} className="tercis-input">
            <option value="all">Todos os setores</option>
            {sectorOptions.map(sector=><option key={sector} value={sector}>{sector}</option>)}
          </select>
        </label>
        <label className="tercis-filterbar-select inline-flex gap-2 items-center">
          <SlidersHorizontal size={15} className="text-slate-400 shrink-0"/>
          <span className="sr-only">Ordenar clientes</span>
          <select aria-label="Ordenar clientes" value={sort}
            onChange={e=>setSort(e.target.value as typeof sort)} className="tercis-input">
            <option value="name">Nome (A–Z)</option>
            <option value="recent">Mais recentes</option>
            <option value="quotes">Mais orçamentos</option>
          </select>
        </label>
        {(query||sectorFilter!=='all'||sort!=='name')&&<button type="button"
          onClick={()=>{setQuery('');setSectorFilter('all');setSort('name');}}
          className="tercis-button tercis-button-neutral"><X size={14}/> Limpar</button>}
      </WorkspaceFilterBar>
    </div>

    {!filtered.length ? <div className="tercis-card">
      <WorkspaceEmptyState icon={<Building2 size={23}/>}
        title={companies.length ? 'Não foram encontrados clientes' : 'Ainda não existem clientes'}
        description={companies.length ? 'Altere o setor, a pesquisa ou a ordenação.' : 'Adicione um cliente para começar a gerir as propostas.'}/>
    </div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {filtered.map(company => <article key={company.id} className="tercis-card tercis-workspace-interactive p-4 space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <span className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-700 shrink-0"><Building2 size={23}/></span>
          <div className="flex items-center gap-1">
            {canManage && <button type="button" aria-label={'Editar ' + company.name}
              onClick={()=>open(company)}
              className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700">
              <Pencil size={16}/></button>}
            <button type="button" onClick={()=>openDetails(company)}
              aria-label={'Abrir ficha de ' + company.name}
              className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><ArrowRight size={17}/></button>
          </div>
        </div>
        <div>
          <button type="button" title={company.name} onClick={()=>openDetails(company)}
            className="font-bold text-[15px] text-slate-900 hover:text-blue-700 truncate block max-w-full text-left">
            {company.name}
          </button>
          <p className="text-xs text-slate-500 mt-1">{company.sector || 'Setor não definido'}</p>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="flex items-center gap-2 truncate"><MapPin size={14} className="text-slate-400 shrink-0"/>{company.city || 'Localização não definida'}</p>
          {company.email && <a href={'mailto:'+company.email}
            className="flex items-center gap-2 truncate hover:text-blue-700"
            title={'Enviar email para '+company.email}>
            <Mail size={14} className="text-slate-400 shrink-0"/>{company.email}</a>}
          {company.phone && <a href={'tel:'+company.phone.replace(/[^0-9+]/g,'')}
            className="flex items-center gap-2 truncate hover:text-blue-700">
            <Phone size={14} className="text-slate-400 shrink-0"/>{company.phone}</a>}
        </div>
        <div className="border-t border-slate-100 pt-3 flex justify-between text-xs">
          <span className="text-slate-500">{serverCounts?'Orçamentos associados':'Orçamentos carregados'}</span>
          <strong>{countFor(company.id)}</strong>
        </div>
      </article>)}
    </div>}

    <WorkspaceDialog open={Boolean(detailCompany)} onClose={()=>setDetailId(null)}
      title={detailCompany?.name||'Ficha do cliente'} size="lg"
      description="Informação comercial e orçamentos associados à conta."
      footer={<>
        <button type="button" onClick={()=>setDetailId(null)}
          className="tercis-button tercis-button-neutral">Fechar</button>
        {detailCompany&&canManage&&<button type="button" onClick={()=>{
          const target=detailCompany;setDetailId(null);open(target);
        }} className="tercis-button tercis-button-primary"><Pencil size={14}/> Editar cliente</button>}
      </>}>
      {detailCompany&&<>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pt-4 pb-3" role="group"
          aria-label="Secções da ficha de cliente">
          <button type="button" aria-pressed={detailTab==='overview'}
            className="tercis-client-tab"
            onClick={()=>setDetailTab('overview')}><Users size={14}/> Contactos</button>
          <button type="button" aria-pressed={detailTab==='quotes'}
            className="tercis-client-tab"
            onClick={()=>setDetailTab('quotes')}><FileText size={14}/> Orçamentos ({countFor(detailCompany.id)})</button>
        </div>
        {detailTab==='overview'&&<div className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['Setor',detailCompany.sector||'Não definido'],
              ['Localidade',detailCompany.city||'Não definida'],
              ['Telefone',detailCompany.phone||'Não indicado'],
              ['Email',detailCompany.email||'Não indicado'],
              ['Identificação fiscal',detailCompany.tax_id||'Não indicada'],
              ['Morada',detailCompany.address||'Não indicada'],
              ['Data de registo',formatDatePt(detailCompany.created_at)],
            ] as const).map(([label,value])=><div key={label}
              className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 min-w-0">
              <span className="block text-[11px] text-slate-500">{label}</span>
              <strong className="block text-[12px] font-semibold text-slate-800 mt-1 break-words">{value}</strong>
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            {detailCompany.email&&<a className="tercis-button tercis-button-neutral"
              href={'mailto:'+detailCompany.email}><Mail size={14}/> Enviar email</a>}
            {detailCompany.phone&&<a className="tercis-button tercis-button-neutral"
              href={'tel:'+detailCompany.phone.replace(/[^0-9+]/g,'')}><Phone size={14}/> Telefonar</a>}
          </div>
          {detailCompany.website&&/^https?:\/\//i.test(detailCompany.website)&&
            <a href={detailCompany.website} target="_blank" rel="noopener noreferrer"
              className="tercis-button tercis-button-neutral" aria-label="Abrir website do cliente">
              Website do cliente <ArrowRight size={14}/>
            </a>}
          {detailCompany.notes&&<section className="rounded-xl border border-slate-100 p-3.5">
            <h3 className="text-[12px] font-bold">Notas do cliente</h3>
            <p className="text-[12px] whitespace-pre-wrap break-words text-slate-600 mt-2">{detailCompany.notes}</p>
          </section>}
        </div>}
        {detailTab==='quotes'&&<div className="pt-4">
          {detailBudgets.length===0
            ?<WorkspaceEmptyState icon={<FileText size={23}/>}
              title="Sem orçamentos carregados"
              description="Esta ficha apresenta apenas os orçamentos já carregados e autorizados na sessão."/>
            :<div className="divide-y divide-slate-100">
              {detailBudgets.slice(0,8).map(budget=><article key={budget.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3">
                <div className="min-w-0 w-full sm:w-auto sm:flex-1">
                  <p className="text-[12px] font-semibold text-slate-900">{budget.name||budget.ref}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{budget.ref} · {formatDatePt(budget.date)}</p>
                  <div className="mt-1.5"><StatusBadge status={budget.status} size="sm"/></div>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
                  <strong className="text-[12px] tabular-nums">{formatCurrency(totalWithTax(budget,budget.items||[]))}</strong>
                  {onOpenInternalNotes&&<button type="button"
                    onClick={()=>{setDetailId(null);onOpenInternalNotes(budget.id);}}
                    className="tercis-button tercis-button-neutral">
                    Notas internas
                  </button>}
                  {onOpenBudget&&<button type="button"
                    onClick={()=>{setDetailId(null);onOpenBudget(budget);}}
                    className="tercis-button tercis-button-neutral">Abrir</button>}
                </div>
              </article>)}
            </div>}
          <p className="mt-3 text-[11px] text-slate-500">
            {serverCounts?'O total de orçamentos provém do servidor; a lista mostra os documentos carregados.':'Esta lista reflete apenas os documentos carregados nesta sessão.'}
          </p>
          {onSeeBudgets&&<button type="button" onClick={()=>{
            const name=detailCompany.name;setDetailId(null);onSeeBudgets(name);
          }} className="tercis-button tercis-button-primary mt-3">
            Consultar orçamentos do cliente <ArrowRight size={14}/>
          </button>}
        </div>}
      </>}
    </WorkspaceDialog>

    <WorkspaceDialog open={isOpen && canManage} onClose={() => setIsOpen(false)} busy={saving}
      title={selected ? 'Editar cliente' : 'Novo cliente'} size="lg"
      description="Identificação e contactos do cliente, organizados por assunto."
      footer={<>
        <button type="button" disabled={saving} onClick={() => setIsOpen(false)}
          className="tercis-button tercis-button-neutral">Cancelar</button>
        <button type="button" disabled={saving} onClick={() => { void save(); }}
          className="tercis-button tercis-button-primary">
          {saving ? 'A guardar…' : 'Guardar cliente'}
        </button>
      </>}>
      <FormSection title="Identificação" description="Dados usados nas propostas e nas pesquisas.">
        <FormGrid>
          <FormField label="Nome da empresa" required wide>
            <input data-autofocus className="tercis-input" required maxLength={200}
              value={form.name} onChange={event => setForm(prev => ({ ...prev, name:event.target.value }))}
              placeholder="Ex.: Empresa Industrial, Lda."/>
          </FormField>
          <FormField label="Setor">
            <input className="tercis-input" value={form.sector} maxLength={120}
              onChange={event => setForm(prev => ({ ...prev, sector:event.target.value }))}
              placeholder="Ex.: Automação industrial"/>
          </FormField>
          <FormField label="Localidade">
            <input className="tercis-input" value={form.city} maxLength={120}
              onChange={event => setForm(prev => ({ ...prev, city:event.target.value }))}
              placeholder="Ex.: Aveiro"/>
          </FormField>
        </FormGrid>
      </FormSection>
      <FormSection title="Contactos" description="Informação para comunicar com a empresa.">
        <FormGrid>
          <FormField label="Email comercial">
            <input className="tercis-input" type="email" autoComplete="email" value={form.email}
              onChange={event => setForm(prev => ({ ...prev, email:event.target.value }))}
              placeholder="contacto@empresa.pt"/>
          </FormField>
          <FormField label="Telefone">
            <input className="tercis-input" type="tel" autoComplete="tel" value={form.phone}
              onChange={event => setForm(prev => ({ ...prev, phone:event.target.value }))}
              placeholder="+351 234 000 000"/>
          </FormField>
        </FormGrid>
      </FormSection>
      <FormSection title="Identificação fiscal e morada" description="Informação adicional para os documentos comerciais.">
        <FormGrid>
          <FormField label="NIF / identificação fiscal">
            <input className="tercis-input" value={form.tax_id} maxLength={36}
              placeholder="NIF ou VAT ID" onChange={event=>setForm(prev=>({...prev,tax_id:event.target.value}))}/>
          </FormField>
          <FormField label="Morada completa" wide>
            <input className="tercis-input" autoComplete="street-address" maxLength={250}
              value={form.address} placeholder="Rua, número, edifício…"
              onChange={event=>setForm(prev=>({...prev,address:event.target.value}))}/>
          </FormField>
        </FormGrid>
      </FormSection>
      <FormSection title="Website e notas" description="Dados úteis para acompanhamento comercial.">
        <FormGrid>
          <FormField label="Website" wide hint="Indique um endereço completo com https:// ou http://.">
            <input className="tercis-input" type="url" maxLength={250}
              placeholder="https://empresa.pt" value={form.website}
              onChange={event=>setForm(prev=>({...prev,website:event.target.value}))}/>
          </FormField>
          <FormField label="Notas comerciais" wide>
            <textarea className="tercis-input resize-y min-h-[88px]" maxLength={2000} rows={3}
              value={form.notes} placeholder="Informações e condições relevantes sobre este cliente…"
              onChange={event=>setForm(prev=>({...prev,notes:event.target.value}))}/>
          </FormField>
        </FormGrid>
      </FormSection>
      {error && <p role="alert" className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-700">{error}</p>}
    </WorkspaceDialog>
  </div>;
}
