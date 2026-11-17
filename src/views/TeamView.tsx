import { useMemo, useState } from 'react';
import { Check, LockKeyhole, Search, Shield, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import type { Budget, Company, Profile, UserRole } from '../types';

interface Props { team: Profile[]; budgets: Budget[]; companies?: Company[]; onRefresh: () => void | Promise<void> }
type EditableRole = Extract<UserRole,'collaborator'|'client'|'company_admin'>;

const labels: Record<UserRole,string> = {
  app_admin:'Admin plataforma',company_admin:'Admin empresa',admin:'Admin legado',
  collaborator:'Colaborador',client:'Cliente',
};
export function TeamView({team,budgets,companies=[],onRefresh}:Props) {
  const {profile,demoMode} = useAuth();
  const canProvision = profile?.role === 'admin' && profile.active && !demoMode;
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState<'all'|'pending'|'active'>('all');
  const [selected,setSelected] = useState<Profile | null>(null);
  const [role,setRole] = useState<EditableRole>('collaborator');
  const [active,setActive] = useState(false);
  const [companyId,setCompanyId] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  const filtered = useMemo(() => {
    const term=query.trim().toLocaleLowerCase('pt-PT');
    return team.filter(member=>(filter==='all'||(filter==='active' ? member.active : !member.active)) &&
      (!term || [member.full_name,member.email,labels[member.role]].some(v=>v.toLocaleLowerCase('pt-PT').includes(term))))
      .sort((a,b)=>Number(a.active)-Number(b.active)||a.full_name.localeCompare(b.full_name,'pt-PT'));
  },[team,query,filter]);

  function select(member:Profile) {
    setSelected(member);
    setRole(member.role==='client'||member.role==='company_admin' ? member.role:'collaborator');
    setActive(member.active);
    setCompanyId(member.company_id||'');
    setError('');
    setNotice('');
  }

  async function save() {
    if(!selected || !canProvision || selected.id===profile?.id) return;
    setBusy(true); setError('');
    try {
      const {error:failure}=await supabase.rpc('tercis_admin_update_user',{
        p_user_id:selected.id,p_role:role,p_active:active,p_company_id:companyId||null,
      });
      if(failure) throw new Error(failure.code==='PGRST202'
        ? 'A migração de aprovação da equipa ainda não foi aplicada no Supabase.'
        : failure.message);
      // The approval transaction has committed. A later refresh failure
      // must not be presented as an unsuccessful approval.
      setSelected(null);
      setNotice('Permissões atualizadas e registadas na auditoria.');
      try {
        await onRefresh();
      } catch {
        setNotice('Permissões guardadas. Não foi possível atualizar a lista; volte a abrir esta página.');
      }
    } catch(reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível guardar.');
    } finally {setBusy(false);}
  }

  return <div className="tercis-page space-y-5">
    <header className="tercis-head">
      <div>
        <p className="tercis-eyebrow">Tercis / Organização</p>
        <h1 className="tercis-title">Equipa</h1>
        <p className="tercis-subtitle">Pessoas, contas pendentes e distribuição de trabalho.</p>
      </div>
      <div className="tercis-badge bg-white text-slate-700 border border-slate-200"><Users size={14} className="mr-2"/>{team.length} perfis visíveis</div>
    </header>

    {notice && <div role="status" className="tercis-note">{notice}</div>}
    {demoMode && <div className="tercis-note">Demonstração: os perfis são fictícios e não podem ser alterados.</div>}
    {!demoMode && !canProvision && <div className="tercis-note flex items-start gap-2">
      <LockKeyhole size={16} className="mt-0.5 shrink-0"/>
      A aprovação e alteração de papéis estão temporariamente limitadas ao administrador legado. A gestão por empresa exige concluir o isolamento das organizações.
    </div>}

    <div className="grid grid-cols-3 gap-3">
      {[
        ['Perfis',team.length],['Ativos',team.filter(member=>member.active).length],['Pendentes',team.filter(member=>!member.active).length],
      ].map(([label,value])=><div key={label} className="tercis-stat">
        <div className="text-[11px] font-semibold text-slate-500">{label}</div>
        <div className="text-2xl font-bold tracking-tight text-slate-900 mt-2">{value}</div>
      </div>)}
    </div>

    <section className="tercis-card overflow-hidden">
      <div className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-200">
        <label className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute top-3 left-3 text-slate-400"/>
          <span className="sr-only">Pesquisar membros da equipa</span>
          <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Pesquisar nome, email ou papel" className="tercis-input pl-10"/>
        </label>
        <select aria-label="Filtrar membros por estado" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}
          className="tercis-input w-auto min-w-32">
          <option value="all">Todos os estados</option><option value="active">Ativos</option><option value="pending">Pendentes</option>
        </select>
      </div>
      {!filtered.length ? <p className="text-sm text-slate-500 p-8 text-center">Não existem perfis que correspondam aos filtros.</p> :
        <div className="overflow-x-auto"><table className="tercis-table min-w-[700px]">
          <thead><tr><th>Utilizador</th><th>Função</th><th>Empresa</th><th>Orçamentos</th><th>Estado</th><th className="text-right">Acesso</th></tr></thead>
          <tbody>{filtered.map(member=><tr key={member.id}>
            <td><div className="flex items-center gap-3"><span className="w-8 h-8 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center shrink-0"><UserRound size={15} className="text-slate-600"/></span>
              <div className="min-w-0"><div className="font-semibold text-slate-900">{member.full_name||'Sem nome'}</div><div className="text-[11px] text-slate-500">{member.email}</div></div></div></td>
            <td><span className="text-slate-700">{labels[member.role]}</span></td>
            <td className="text-slate-600">{companies.find(c=>c.id===member.company_id)?.name||'—'}</td>
            <td className="tabular-nums">{budgets.filter(b=>b.created_by===member.id||b.assigned_to===member.id).length}</td>
            <td><span className={'tercis-badge '+(member.active?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>{member.active?'Ativo':'Aprovação pendente'}</span></td>
            <td className="text-right">
              {canProvision && member.id!==profile?.id && !['admin','app_admin'].includes(member.role)
                ? <button type="button" onClick={()=>select(member)} className="text-xs font-semibold text-blue-700 hover:underline">Gerir</button>
                : <span className="text-slate-400 text-xs">Protegido</span>}
            </td>
          </tr>)}</tbody>
        </table></div>}
    </section>

    {selected && canProvision && <div className="fixed inset-0 z-[90] bg-slate-950/40 flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
      <section role="dialog" aria-modal="true" aria-labelledby="team-dialog-heading" className="tercis-card w-full max-w-md p-5 sm:p-6 space-y-4 shadow-xl">
        <header className="flex justify-between gap-3 items-center">
          <h2 id="team-dialog-heading" className="font-bold text-lg">Gerir acesso</h2>
          <button onClick={()=>setSelected(null)} aria-label="Fechar" className="p-2 hover:bg-slate-100 rounded-lg"><X size={19}/></button>
        </header>
        <p className="text-xs text-slate-500">{selected.full_name} · {selected.email}</p>
        <label className="block text-xs font-semibold">Papel
          <select value={role} onChange={e=>setRole(e.target.value as EditableRole)} className="tercis-input mt-2">
            <option value="collaborator">Colaborador</option><option value="client">Cliente</option><option value="company_admin">Administrador da empresa</option>
          </select>
        </label>
        <label className="block text-xs font-semibold">Empresa associada
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="tercis-input mt-2">
            <option value="">Sem empresa associada</option>
            {companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} className="accent-blue-600"/> Conta ativa
        </label>
        <p className="text-xs text-slate-500">A ativação de clientes e administradores de empresa exige associar uma empresa. Esta ação fica registada na auditoria.</p>
        {error && <p role="alert" className="text-xs p-3 bg-rose-50 rounded-lg text-rose-700">{error}</p>}
        <footer className="flex justify-end gap-2">
          <button className="tercis-button tercis-button-neutral" onClick={()=>setSelected(null)}>Cancelar</button>
          <button disabled={busy} className="tercis-button tercis-button-primary" onClick={()=>{void save()}}>
            {busy?'A guardar…':<><Check size={15}/> Guardar acesso</>}
          </button>
        </footer>
      </section>
    </div>}

    <p className="flex gap-2 items-start text-xs text-slate-500"><Shield size={15} className="mt-0.5 shrink-0"/>
      As permissões de interface não substituem RLS no PostgreSQL. Os administradores legados devem ser migrados para organizações independentes antes de servir empresas distintas.
    </p>
  </div>;
}
