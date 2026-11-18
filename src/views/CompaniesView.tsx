import { useEffect, useMemo, useState } from 'react';
import { Building2, Mail, MapPin, Pencil, Plus, Search } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { hasPermission } from '../domain/workflow';
import { supabase } from '../lib/supabase';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { FormSection, FormGrid, FormField } from '../components/FormLayout';
import { WorkspaceEmptyState, WorkspaceFilterBar } from '../components/WorkspacePrimitives';
import type { Budget, Company } from '../types';

type Props = { companies: Company[]; budgets: Budget[]; onRefresh: () => void | Promise<void> };
type Fields = { name: string; city: string; sector: string; email: string; phone: string };
const blank: Fields = { name: '', city: '', sector: '', email: '', phone: '' };

export function CompaniesView({ companies, budgets, onRefresh }: Props) {
  const { profile, demoMode } = useAuth();
  const canManage = !demoMode && (profile?.role === 'admin' || profile?.role === 'company_admin') && hasPermission(profile, 'manage_clients');
  const [query, setQuery] = useState('');
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
  },[demoMode,profile?.id,companies,budgets]);

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase('pt-PT').trim();
    return [...companies].filter(company => !q || [company.name,company.city,company.sector,company.email]
      .some(value => (value || '').toLocaleLowerCase('pt-PT').includes(q)))
      .sort((a,b)=>a.name.localeCompare(b.name,'pt-PT'));
  }, [companies,query]);

  function open(company: Company | null) {
    setSelected(company);
    setForm(company ? {
      name: company.name, city: company.city || '', sector: company.sector || '',
      email: company.email || '', phone: company.phone || '',
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
    setSaving(true);
    setError(null);
    try {
      const fields = {
        name, city:form.city.trim(), sector:form.sector.trim(),
        email:form.email.trim(), phone:form.phone.trim(),
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
        <p className="text-sm text-slate-500 mt-2">{companies.length} empresas ativas · informação da conta</p>
      </div>
      {canManage && <button onClick={()=>open(null)} className="tercis-button tercis-button-primary inline-flex items-center gap-2"><Plus size={17}/> Novo cliente</button>}
    </header>

    {demoMode && <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">Modo demonstração: os clientes apresentados são exemplos. A edição está desativada.</p>}
    {error && !isOpen && <p role="status" className="tercis-note">{error}</p>}

    <div className="tercis-card overflow-hidden">
      <WorkspaceFilterBar count={`${filtered.length} clientes visíveis`}>
        <label className="tercis-filterbar-search">
          <Search size={16} className="absolute top-[13px] left-3 text-slate-400"/>
          <span className="sr-only">Pesquisar clientes</span>
          <input className="tercis-input pl-9" type="search"
            placeholder="Pesquisar empresa, setor, localidade ou email…"
            value={query} onChange={event=>setQuery(event.target.value)}/>
        </label>
        {query && <button type="button" onClick={()=>setQuery('')}
          className="tercis-button tercis-button-neutral">Limpar</button>}
      </WorkspaceFilterBar>
    </div>

    {!filtered.length ? <div className="tercis-card">
      <WorkspaceEmptyState icon={<Building2 size={23}/>}
        title={companies.length ? 'Não foram encontrados clientes' : 'Ainda não existem clientes'}
        description={companies.length ? 'Experimente outro termo de pesquisa.' : 'Adicione um cliente para começar a gerir as propostas.'}/>
    </div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {filtered.map(company => <article key={company.id} className="tercis-card tercis-workspace-interactive p-4 space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <span className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center text-blue-700 shrink-0"><Building2 size={23}/></span>
          {canManage && <button aria-label={'Editar ' + company.name} onClick={()=>open(company)} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil size={16}/></button>}
        </div>
        <div>
          <h2 className="font-bold text-[15px] text-slate-900 truncate" title={company.name}>{company.name}</h2>
          <p className="text-xs text-slate-500 mt-1">{company.sector || 'Setor não definido'}</p>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="flex items-center gap-2 truncate"><MapPin size={14} className="text-slate-400 shrink-0"/>{company.city || 'Localização não definida'}</p>
          {company.email && <p className="flex items-center gap-2 truncate"><Mail size={14} className="text-slate-400 shrink-0"/>{company.email}</p>}
        </div>
        <div className="border-t border-slate-100 pt-3 flex justify-between text-xs">
          <span className="text-slate-500">{serverCounts?'Orçamentos associados':'Orçamentos carregados'}</span>
          <strong>{serverCounts?.[company.id] ?? budgets.filter(b=>b.company_id === company.id).length}</strong>
        </div>
      </article>)}
    </div>}

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
      {error && <p role="alert" className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-700">{error}</p>}
    </WorkspaceDialog>
  </div>;
}
