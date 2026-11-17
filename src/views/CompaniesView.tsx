import { useMemo, useState } from 'react';
import { Building2, Mail, MapPin, Pencil, Plus, Search, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { hasPermission } from '../domain/workflow';
import { supabase } from '../lib/supabase';
import type { Budget, Company } from '../types';

type Props = { companies: Company[]; budgets: Budget[]; onRefresh: () => void | Promise<void> };
type Fields = { name: string; city: string; sector: string; email: string; phone: string };
const blank: Fields = { name: '', city: '', sector: '', email: '', phone: '' };

export function CompaniesView({ companies, budgets, onRefresh }: Props) {
  const { profile, demoMode } = useAuth();
  const canManage = !demoMode && profile?.role === 'admin' && hasPermission(profile, 'manage_clients');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState<Fields>(blank);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    <label className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
      <Search size={18} className="text-slate-400"/>
      <span className="sr-only">Pesquisar clientes</span>
      <input className="flex-1 min-w-0 outline-none text-sm" placeholder="Pesquisar por empresa, setor ou email…" value={query} onChange={event=>setQuery(event.target.value)}/>
    </label>

    {!filtered.length ? <div className="rounded-2xl bg-white border border-slate-200 text-center p-16">
      <Building2 size={32} className="text-slate-300 mx-auto mb-3"/>
      <p className="font-semibold">{companies.length ? 'Não foram encontrados clientes' : 'Ainda não existem clientes'}</p>
      <p className="text-sm text-slate-500 mt-1">{companies.length ? 'Experimente outro termo de pesquisa.' : 'Adicione o primeiro cliente quando o sistema estiver configurado.'}</p>
    </div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {filtered.map(company => <article key={company.id} className="tercis-card p-4 space-y-3 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <span className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-700 shrink-0"><Building2 size={23}/></span>
          {canManage && <button aria-label={'Editar ' + company.name} onClick={()=>open(company)} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil size={16}/></button>}
        </div>
        <div>
          <h2 className="font-bold text-lg text-slate-900 truncate" title={company.name}>{company.name}</h2>
          <p className="text-xs text-slate-500 mt-1">{company.sector || 'Setor não definido'}</p>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <p className="flex items-center gap-2 truncate"><MapPin size={14} className="text-slate-400 shrink-0"/>{company.city || 'Localização não definida'}</p>
          {company.email && <p className="flex items-center gap-2 truncate"><Mail size={14} className="text-slate-400 shrink-0"/>{company.email}</p>}
        </div>
        <div className="border-t border-slate-100 pt-4 flex justify-between text-xs">
          <span className="text-slate-500">Orçamentos associados</span>
          <strong>{budgets.filter(b=>b.company_id === company.id).length}</strong>
        </div>
      </article>)}
    </div>}

    {isOpen && canManage && <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setIsOpen(false)}}>
      <section role="dialog" aria-modal="true" aria-labelledby="client-dialog-title" className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-5 sm:p-7 space-y-5">
        <header className="flex items-center justify-between">
          <h2 id="client-dialog-title" className="text-xl font-bold">{selected ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button aria-label="Fechar" onClick={()=>setIsOpen(false)} className="p-2 rounded-lg hover:bg-slate-100"><X size={20}/></button>
        </header>
        <div className="space-y-3">
          {([
            ['name','Empresa','Nome da empresa'],
            ['sector','Setor','Ex.: Automação Industrial'],
            ['city','Localidade','Ex.: Aveiro'],
            ['email','Email','contacto@empresa.pt'],
            ['phone','Telefone','Contacto telefónico'],
          ] as const).map(([key,label,placeholder])=><label key={key} className="block text-sm font-semibold text-slate-700">
            {label}<input value={form[key]} onChange={event=>setForm(prev=>({...prev,[key]:event.target.value}))} placeholder={placeholder}
              className="block mt-1.5 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 outline-none"/>
          </label>)}
        </div>
        {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</p>}
        <footer className="flex justify-end gap-2 pt-3">
          <button onClick={()=>setIsOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold">Cancelar</button>
          <button disabled={saving} onClick={()=>{void save()}} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">{saving ? 'A guardar…':'Guardar cliente'}</button>
        </footer>
      </section>
    </div>}
  </div>;
}
