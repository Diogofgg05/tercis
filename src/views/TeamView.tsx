import { useMemo, useState } from 'react';
import { Check, LockKeyhole, Search, Shield, UserRound, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { WorkspaceDialog } from '../components/WorkspaceDialog';
import { FormSection, FormGrid, FormField } from '../components/FormLayout';
import { WorkspaceEmptyState } from '../components/WorkspacePrimitives';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import type { Budget, Company, Profile, UserRole } from '../types';

interface Props { team: Profile[]; budgets: Budget[]; companies?: Company[]; onRefresh: () => void | Promise<void> }
type EditableRole = Extract<UserRole,'collaborator'|'client'|'company_admin'>;

const labels: Record<UserRole,string> = {
  app_admin:'Admin plataforma',company_admin:'Admin empresa',admin:'Admin legado',
  collaborator:'Colaborador',client:'Cliente',
};
export function TeamView({team,budgets,companies=[],onRefresh}:Props) {
  const {profile,demoMode} = useAuth();
  const canProvision = (profile?.role === 'admin' || profile?.role === 'company_admin') && profile.active && !demoMode;
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState<'all'|'pending'|'active'>('all');
  const [selected,setSelected] = useState<Profile | null>(null);
  const [role,setRole] = useState<EditableRole>('collaborator');
  const [active,setActive] = useState(false);
  const [companyId,setCompanyId] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [inviteEmail,setInviteEmail] = useState('');
  const [inviteToken,setInviteToken] = useState('');
  const [inviteBusy,setInviteBusy] = useState(false);
  const [confirmRevokeInvites,setConfirmRevokeInvites]=useState(false);
  const [inviteError,setInviteError] = useState('');

  // Build budget counts once, rather than re-scanning all budgets per team row.
  const quoteCounts=useMemo(()=>{
    const counts=new Map<string,number>();
    for(const budget of budgets){
      for(const userId of new Set([budget.created_by,budget.assigned_to].filter((v):v is string=>Boolean(v)))){
        counts.set(userId,(counts.get(userId)||0)+1);
      }
    }
    return counts;
  },[budgets]);
  const filtered = useMemo(() => {
    const term=query.trim().toLocaleLowerCase('pt-PT');
    return team.filter(member=>(filter==='all'||(filter==='active' ? member.active : !member.active)) &&
      (!term || [member.full_name,member.email,labels[member.role]].some(v=>v.toLocaleLowerCase('pt-PT').includes(term))))
      .sort((a,b)=>Number(a.active)-Number(b.active)||a.full_name.localeCompare(b.full_name,'pt-PT'));
  },[team,query,filter]);

  function select(member:Profile) {
    if(profile?.role === 'company_admin' && ['admin','company_admin','app_admin'].includes(member.role)) return;
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

  async function revokeInvites(){
    const email=inviteEmail.trim().toLowerCase();
    if(!canProvision||!email||inviteBusy)return;
    setInviteBusy(true);setInviteError('');
    try{
      const {data,error:failure}=await supabase.rpc('tercis_revoke_organization_invites',{
        p_email:email,
      });
      if(failure)throw failure;
      setConfirmRevokeInvites(false);
      setInviteToken('');
      setNotice(Number(data)>0
        ? Number(data)+' convite(s) pendente(s) revogado(s).'
        :'Não existem convites válidos por utilizar para este email.');
    }catch(cause){
      setInviteError(cause instanceof Error?cause.message:'Não foi possível revogar convites.');
    }finally{setInviteBusy(false);}
  }

    async function createInvite() {
    if (!canProvision || !inviteEmail.trim()) return;
    setInviteBusy(true); setInviteError(''); setInviteToken('');
    try {
      const {data,error:failure}=await supabase.rpc('tercis_create_organization_invite', {
        p_email:inviteEmail.trim().toLowerCase(),
      });
      if(failure) throw new Error(failure.code==='PGRST202'
        ? 'Ainda não foi instalada a migração de convites seguros.' : failure.message);
      if(typeof data!=='string') throw new Error('Não foi devolvido um código de convite.');
      setInviteToken(data);
    } catch(cause) {
      setInviteError(cause instanceof Error?cause.message:'Não foi possível criar o convite.');
    } finally {setInviteBusy(false);}
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
    {!demoMode && !canProvision && <div className="tercis-note flex items-start gap-2">
      <LockKeyhole size={16} className="mt-0.5 shrink-0"/>
      Apenas administradores da organização podem aprovar membros ou emitir convites. A gestão de outras organizações não é permitida.
    </div>}

    {canProvision && <section className="tercis-card p-4 sm:p-5 space-y-3">
      <h2 className="font-bold text-sm text-slate-800">Convidar para a organização</h2>
      <p className="text-xs text-slate-600">A pessoa deve registar-se, confirmar o email e aceitar o código. Só depois poderá ser aprovada pela administração. O código é válido por 7 dias e para uma única utilização.</p>
      <div className="flex gap-2 flex-wrap">
        <label className="sr-only" htmlFor="invite-team-email">Email para convite</label>
        <input id="invite-team-email" type="email" autoComplete="off" value={inviteEmail}
          onChange={event=>setInviteEmail(event.target.value)} placeholder="colaborador@empresa.pt"
          className="tercis-input flex-1 min-w-[200px]" />
        <button type="button" disabled={inviteBusy || !inviteEmail.trim()} onClick={()=>{void createInvite();}}
          className="tercis-button tercis-button-primary disabled:opacity-50">{inviteBusy?'A criar…':'Criar convite'}</button>
        <button type="button" disabled={inviteBusy || !inviteEmail.trim()}
          onClick={()=>setConfirmRevokeInvites(true)}
          className="tercis-button tercis-button-neutral disabled:opacity-50">
          Revogar pendentes
        </button>
      </div>
      {inviteError && <p role="alert" className="text-xs text-rose-700">{inviteError}</p>}
      {inviteToken && <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-2">
        <p className="text-xs text-blue-900 font-semibold">Código de convite para {inviteEmail}</p>
        <div className="flex gap-2 flex-wrap items-center">
          <input type="text" readOnly aria-label="Código de convite criado" value={inviteToken}
            className="tercis-input flex-1 min-w-[220px] font-mono text-xs" onFocus={event=>event.target.select()} />
          <button type="button" className="tercis-button tercis-button-neutral" onClick={()=>{
            void navigator.clipboard.writeText(inviteToken).then(()=>{
              setNotice('Código de convite copiado.');
            }).catch(()=>{
              setInviteError('Não foi possível copiar. Selecione e copie o código manualmente.');
            });
          }}>Copiar código</button>
        </div>
        <p className="text-[11px] text-blue-900">Partilha o código apenas com o destinatário. O Tercis ainda não envia emails de convite automaticamente.</p>
      </div>}
    </section>}

    <div className="grid grid-cols-3 gap-3">
      {[
        ['Perfis',team.length],['Ativos',team.filter(member=>member.active).length],['Pendentes',team.filter(member=>!member.active).length],
      ].map(([label,value])=><div key={label} className="tercis-stat">
        <div className="text-[11px] font-semibold text-slate-500">{label}</div>
        <div className="text-2xl font-bold tracking-tight text-slate-900 mt-2">{value}</div>
      </div>)}
    </div>

    <section className="tercis-card overflow-hidden">
      <div className="tercis-filterbar">
        <label className="tercis-filterbar-search">
          <Search size={16} className="absolute top-3 left-3 text-slate-400"/>
          <span className="sr-only">Pesquisar membros da equipa</span>
          <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Pesquisar nome, email ou papel" className="tercis-input pl-10"/>
        </label>
        <select aria-label="Filtrar membros por estado" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}
          className="tercis-input tercis-filterbar-select">
          <option value="all">Todos os estados</option><option value="active">Ativos</option><option value="pending">Pendentes</option>
        </select>
      </div>
      {!filtered.length ? <WorkspaceEmptyState icon={<Users size={23}/>}
        title="Sem utilizadores encontrados" description="Experimente alterar a pesquisa ou o filtro de estado."/> :
        <>
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.map(member=><article key={member.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3 items-start">
                <span className="tercis-attachment-icon shrink-0"><UserRound size={20}/></span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-[13px] break-words text-slate-900">{member.full_name||'Sem nome'}</h3>
                  <p className="text-[11px] text-slate-500 break-all mt-1">{member.email}</p>
                </div>
              </div>
              <span className={'tercis-badge '+(member.active?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>
                {member.active?'Ativo':'Pendente'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div><span className="block text-slate-500 mb-1">Papel</span>
                <strong className="text-slate-800">{labels[member.role]}</strong></div>
              <div><span className="block text-slate-500 mb-1">Empresa</span>
                <strong className="text-slate-800">{companies.find(c=>c.id===member.company_id)?.name||'—'}</strong></div>
            </div>
            {canProvision && member.id!==profile?.id && !['admin','app_admin'].includes(member.role)
              && (profile?.role==='admin'||member.role!=='company_admin') && <div className="border-t border-slate-100 pt-3">
                <button type="button" onClick={()=>select(member)}
                  className="tercis-button tercis-button-neutral w-full">Gerir acesso</button>
              </div>}
          </article>)}
        </div>
        <div className="hidden md:block overflow-x-auto"><table className="tercis-table min-w-[700px]">
          <thead><tr><th>Utilizador</th><th>Função</th><th>Empresa</th><th>Orçamentos carregados</th><th>Estado</th><th className="text-right">Acesso</th></tr></thead>
          <tbody>{filtered.map(member=><tr key={member.id}>
            <td><div className="flex items-center gap-3"><span className="w-8 h-8 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center shrink-0"><UserRound size={15} className="text-slate-600"/></span>
              <div className="min-w-0"><div className="font-semibold text-slate-900">{member.full_name||'Sem nome'}</div><div className="text-[11px] text-slate-500">{member.email}</div></div></div></td>
            <td><span className="text-slate-700">{labels[member.role]}</span></td>
            <td className="text-slate-600">{companies.find(c=>c.id===member.company_id)?.name||'—'}</td>
            <td className="tabular-nums">{quoteCounts.get(member.id)||0}</td>
            <td><span className={'tercis-badge '+(member.active?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>{member.active?'Ativo':'Aprovação pendente'}</span></td>
            <td className="text-right">
              {canProvision && member.id!==profile?.id && !['admin','app_admin'].includes(member.role) && (profile?.role==='admin' || member.role!=='company_admin')
                ? <button type="button" onClick={()=>select(member)} className="tercis-button tercis-button-neutral">Gerir</button>
                : <span className="text-slate-400 text-xs">Protegido</span>}
            </td>
          </tr>)}</tbody>
        </table></div></>}
    </section>

    <WorkspaceDialog open={Boolean(selected && canProvision)}
      title="Gerir acesso" description={selected ? selected.full_name + ' · ' + selected.email : undefined}
      onClose={() => setSelected(null)} size="md" busy={busy}
      footer={<>
        <button type="button" disabled={busy} className="tercis-button tercis-button-neutral"
          onClick={() => setSelected(null)}>Cancelar</button>
        <button type="button" disabled={busy} className="tercis-button tercis-button-primary"
          onClick={() => { void save(); }}>
          {busy ? 'A guardar…' : <><Check size={15}/> Guardar acesso</>}
        </button>
      </>}>
      <FormSection title="Papel e organização"
        description="Defina a função e a empresa a que este utilizador pertence.">
        <FormGrid>
          <FormField label="Papel de utilizador">
            <select data-autofocus value={role} onChange={e => setRole(e.target.value as EditableRole)}
              className="tercis-input">
              <option value="collaborator">Colaborador</option>
              <option value="client">Cliente</option>
              {profile?.role === 'admin' && <option value="company_admin">Administrador da empresa</option>}
            </select>
          </FormField>
          <FormField label="Empresa associada">
            <select value={companyId} onChange={e => setCompanyId(e.target.value)}
              className="tercis-input">
              <option value="">Sem empresa associada</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </FormField>
        </FormGrid>
      </FormSection>
      <FormSection title="Estado da conta" description="A ativação e as alterações são registadas na auditoria.">
        <label className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer">
          <span>
            <strong className="block text-[13px] text-slate-900">Conta ativa</strong>
            <span className="text-[11px] text-slate-500">Permitir que este utilizador entre na plataforma.</span>
          </span>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
            className="accent-blue-600 w-4 h-4"/>
        </label>
        <p className="text-[11px] text-slate-500 mt-3">
          Para ativar clientes e administradores de empresa, deve existir uma empresa associada.
        </p>
      </FormSection>
      {error && <p role="alert" className="text-xs p-3 bg-rose-50 rounded-xl text-rose-700">{error}</p>}
    </WorkspaceDialog>

    <ConfirmActionDialog open={confirmRevokeInvites}
      onClose={()=>setConfirmRevokeInvites(false)}
      onConfirm={()=>{void revokeInvites();}} busy={inviteBusy}
      danger title="Revogar convites pendentes?"
      description="Os convites ainda não utilizados para este email deixam de ser válidos."
      confirmLabel="Revogar convites">
      <p>Destinatário: <strong className="break-all">{inviteEmail.trim().toLowerCase()}</strong></p>
      <p className="mt-2">Esta operação não desativa contas já aprovadas.</p>
      {inviteError&&<p role="alert" className="text-rose-700 mt-2">{inviteError}</p>}
    </ConfirmActionDialog>

    <p className="flex gap-2 items-start text-xs text-slate-500"><Shield size={15} className="mt-0.5 shrink-0"/>
      As permissões de interface não substituem RLS no PostgreSQL. Os administradores legados devem ser migrados para organizações independentes antes de servir empresas distintas.
    </p>
  </div>;
}
