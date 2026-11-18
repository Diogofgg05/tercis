import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Copy, Link2, Plus, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { WorkspaceDialog } from './WorkspaceDialog';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import type { Company } from '../types';

type Relationship='client'|'supplier'|'both';
type LinkState='pending'|'active'|'expired'|'revoked';
type BusinessLink={
  id:string;
  local_company_id:string|null;
  local_company_name:string|null;
  partner_name:string|null;
  relationship_type:Relationship;
  status:LinkState;
  owned_by_me:boolean;
  created_at:string;
  expires_at:string;
};

const relationshipLabel:Record<Relationship,string>={
  client:'Cliente',supplier:'Fornecedor',both:'Cliente e fornecedor',
};
const statusLabel:Record<LinkState,string>={
  pending:'Convite pendente',active:'Ligação ativa',
  expired:'Convite expirado',revoked:'Revogada',
};

type Props={companies:Company[]; onUpdated?:()=>void};
/**
 * A client/supplier relationship is distinct from tenant membership.
 * A one-use code must be accepted by an admin of the OTHER organization;
 * neither side gains access to the other's documents or private directory.
 */
export function BusinessLinksPanel({companies,onUpdated}:Props){
  const {profile,demoMode}=useAuth();
  const allowed=!demoMode&&Boolean(profile?.active&&
    (profile.role==='admin'||profile.role==='company_admin'));
  const [links,setLinks]=useState<BusinessLink[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [createOpen,setCreateOpen]=useState(false);
  const [acceptOpen,setAcceptOpen]=useState(false);
  const [companyId,setCompanyId]=useState('');
  const [role,setRole]=useState<Relationship>('client');
  const [acceptCode,setAcceptCode]=useState('');
  const [preview,setPreview]=useState<{
    token:string;
    organization_name:string;
    local_company_name:string;
    relationship_type:Relationship;
    expires_at:string;
  }|null>(null);
  const [issuedCode,setIssuedCode]=useState<string|null>(null);
  const [revokeId,setRevokeId]=useState<string|null>(null);

  const refresh=useCallback(async()=>{
    if(!allowed){setLinks([]);return;}
    setLoading(true);
    try{
      const {data,error:failure}=await supabase.rpc('tercis_list_business_links');
      if(failure)throw failure;
      setLinks((data||[]) as BusinessLink[]);
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível consultar as relações.');
    }finally{setLoading(false);}
  },[allowed,profile?.id]);
  useEffect(()=>{void refresh();},[refresh]);

  async function issue(){
    if(!companyId||busy)return;
    setBusy(true);setError('');setIssuedCode(null);setNotice('');
    try{
      const {data,error:failure}=await supabase.rpc('tercis_create_business_link_invite',{
        p_company_id:companyId,p_relationship_type:role,
      });
      if(failure)throw failure;
      if(typeof data!=='string'||!data)throw new Error('Código indisponível.');
      setIssuedCode(data);
      setNotice('Convite emitido. Partilhe o código de forma segura com um administrador da outra empresa.');
      await refresh();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Falha ao emitir convite.');
    }finally{setBusy(false);}
  }
  async function inspectInvite(){
    if(busy)return;
    const token=acceptCode.trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)){
      setError('Introduza um código de convite válido.');
      return;
    }
    setBusy(true);setError('');setPreview(null);
    try{
      const {data,error:failure}=await supabase.rpc('tercis_preview_business_link_invite',{
        p_token:token,
      });
      if(failure)throw failure;
      if(!data||typeof data!=='object')throw new Error('Convite indisponível.');
      const info=data as {
        organization_name:string;
        local_company_name:string;
        relationship_type:Relationship;
        expires_at:string;
      };
      if(!info.organization_name || !relationshipLabel[info.relationship_type])
        throw new Error('Convite inválido.');
      setPreview({token,...info});
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível consultar o convite.');
    }finally{setBusy(false);}
  }

  async function accept(){
    if(busy)return;
    if(!preview||preview.token!==acceptCode.trim()){
      setError('Consulte os detalhes do convite antes de o aceitar.');
      return;
    }
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(acceptCode.trim())){
      setError('Introduza um código de convite UUID válido.');
      return;
    }
    setBusy(true);setError('');setNotice('');
    try{
      const {error:failure}=await supabase.rpc('tercis_accept_business_link_invite',{
        p_token:acceptCode.trim(),
      });
      if(failure)throw failure;
      setAcceptOpen(false);setAcceptCode('');setPreview(null);
      setNotice('Relação aceite. Cada empresa mantém os seus dados privados.');
      await refresh();onUpdated?.();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível aceitar o convite.');
    }finally{setBusy(false);}
  }
  async function revoke(){
    if(!revokeId||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const {data,error:failure}=await supabase.rpc('tercis_revoke_business_link',{
        p_link_id:revokeId,
      });
      if(failure)throw failure;
      if(data!==true)throw new Error('Esta ligação já não está ativa.');
      setRevokeId(null);
      setNotice('Ligação comercial revogada.');
      await refresh();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Falha ao revogar a ligação.');
    }finally{setBusy(false);}
  }
  if(!allowed)return null;
  return <section className="tercis-card overflow-hidden" aria-label="Relações entre empresas">
    <header className="tercis-card-header flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="tercis-card-title flex items-center gap-2">
          <ArrowLeftRight size={17} className="text-blue-700"/> Relações entre empresas
        </h2>
        <p className="text-[11px] text-slate-500 mt-1">
          A mesma empresa pode ser cliente ou fornecedora de outra organização TERCIS.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={()=>{
          setError('');setIssuedCode(null);setCompanyId(companies[0]?.id||'');
          setCreateOpen(true);
        }} className="tercis-button tercis-button-neutral">
          <Plus size={15}/> Convidar empresa
        </button>
        <button type="button" disabled={busy} onClick={()=>{
          setError('');setPreview(null);setAcceptCode('');setAcceptOpen(true);
        }} className="tercis-button tercis-button-primary">
          <Link2 size={15}/> Aceitar ligação
        </button>
      </div>
    </header>
    <div className="px-4 py-3 border-b border-blue-100 bg-[#f4f9ff] flex items-start gap-2 text-[11px] text-slate-600">
      <ShieldCheck size={16} className="text-blue-700 shrink-0 mt-0.5"/>
      <p>Uma ligação exige consentimento dos dois administradores e MFA.
        Não partilha automaticamente orçamentos, fotografias, ficheiros, clientes ou colaboradores.</p>
    </div>
    {notice&&<p role="status" className="tercis-note m-4">{notice}</p>}
    {error&&!createOpen&&!acceptOpen&&<p role="alert" className="p-4 text-xs text-rose-700">{error}</p>}
    {loading?<p role="status" className="p-5 text-xs text-slate-500">A carregar ligações…</p>:
      !links.length?<div className="p-6 text-center space-y-2">
        <div className="w-12 h-12 mx-auto bg-blue-50 rounded-xl grid place-items-center text-blue-700">
          <ArrowLeftRight size={23}/>
        </div>
        <p className="text-[13px] font-semibold">Ainda não existem relações ligadas</p>
        <p className="text-[11px] text-slate-500">Envie um convite a outra organização ou aceite um código que recebeu.</p>
      </div>:<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
        {links.map(link=><article key={link.id} className="rounded-xl border border-slate-200 bg-white p-3.5 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={'text-[10px] font-semibold '+(link.status==='active'?'text-emerald-700':'text-slate-500')}>
              {link.status==='active'&&<CheckCircle2 size={13} className="inline mr-1"/>}
              {statusLabel[link.status]||link.status}
            </span>
            <span className="text-[10px] text-slate-500">{link.owned_by_me?'Convite enviado':'Convite aceite'}</span>
          </div>
          <h3 className="text-[13px] font-semibold text-slate-900 break-words mt-2">
            {link.owned_by_me
              ?(link.local_company_name||'Cliente ou fornecedor local')
              :(link.partner_name||'Organização parceira')}
          </h3>
          <p className="text-[11px] text-slate-600 mt-1">{relationshipLabel[link.relationship_type]}</p>
          {link.owned_by_me&&link.partner_name&&
            <p className="text-[11px] text-slate-500 mt-1">Organização ligada: {link.partner_name}</p>}
          {link.status==='pending'&&<p className="text-[10px] text-amber-700 mt-2">
            Expira a {new Date(link.expires_at).toLocaleDateString('pt-PT')}
          </p>}
          {!['revoked','expired'].includes(link.status)&&<button type="button"
            className="tercis-button tercis-button-neutral mt-3 text-rose-700"
            onClick={()=>setRevokeId(link.id)}>
            <XCircle size={14}/> {link.status==='pending'?'Revogar convite':'Desligar empresas'}
          </button>}
        </article>)}
      </div>}
    <WorkspaceDialog open={createOpen} onClose={()=>{setCreateOpen(false);setIssuedCode(null);}} busy={busy}
      title="Convidar uma empresa TERCIS" size="md"
      description="Escolha o cliente ou fornecedor que já existe na sua organização. O convite expira em 7 dias."
      footer={<>
        <button type="button" disabled={busy} className="tercis-button tercis-button-neutral"
          onClick={()=>{setCreateOpen(false);setIssuedCode(null);}}>Fechar</button>
        {!issuedCode&&<button type="button" disabled={busy||!companyId}
          className="tercis-button tercis-button-primary" onClick={()=>{void issue();}}>
          Criar convite
        </button>}
      </>}>
      <div className="space-y-3 pt-2">
        <label className="block text-xs font-semibold">Ficha local
          <select value={companyId} className="tercis-input mt-2"
            onChange={event=>setCompanyId(event.target.value)} disabled={Boolean(issuedCode)}>
            {!companyId&&<option value="">Escolha uma empresa</option>}
            {companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold">Papel da empresa na sua organização
          <select className="tercis-input mt-2" value={role}
            onChange={event=>setRole(event.target.value as Relationship)}
            disabled={Boolean(issuedCode)}>
            <option value="client">Cliente</option>
            <option value="supplier">Fornecedor</option>
            <option value="both">Cliente e fornecedor</option>
          </select>
        </label>
        {issuedCode&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-bold text-blue-900">Código de utilização única</p>
          <code className="block break-all text-[12px] mt-2">{issuedCode}</code>
          <button type="button" className="tercis-button tercis-button-neutral mt-3"
            onClick={()=>{
              void navigator.clipboard.writeText(issuedCode).then(()=>{
                setNotice('Convite copiado.');
              }).catch(()=>setError('Não foi possível copiar. Copie manualmente o código.'));
            }}><Copy size={14}/> Copiar código</button>
          <p className="text-[11px] text-blue-900 mt-3">
            O código não poderá ser recuperado. Envie-o apenas ao administrador da empresa pretendida.
          </p>
        </div>}
        {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
      </div>
    </WorkspaceDialog>
    <WorkspaceDialog open={acceptOpen} onClose={()=>{setAcceptOpen(false);setPreview(null);}} busy={busy}
      title="Aceitar ligação comercial" size="md"
      description="Introduza o código enviado por um administrador da outra organização."
      footer={<>
        <button type="button" disabled={busy} className="tercis-button tercis-button-neutral"
          onClick={()=>{setAcceptOpen(false);setPreview(null);}}>Cancelar</button>
        {!preview&&<button type="button" disabled={busy||!acceptCode.trim()}
          className="tercis-button tercis-button-primary" onClick={()=>{void inspectInvite();}}>
          Verificar convite
        </button>}
        {preview&&<button type="button" disabled={busy||preview.token!==acceptCode.trim()}
          className="tercis-button tercis-button-primary" onClick={()=>{void accept();}}>
          Confirmar ligação
        </button>}
      </>}>
      <label className="block text-xs font-semibold pt-2">Código de convite
        <input className="tercis-input mt-2" data-autofocus
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          maxLength={36} value={acceptCode}
          onChange={event=>{
            setAcceptCode(event.target.value);
            setPreview(null);
            setError('');
          }}/>
      </label>
      {preview&&<div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 mt-3">
        <p className="text-[10px] font-bold text-blue-800">Confirme os dados da outra empresa</p>
        <p className="text-[13px] font-bold mt-2 text-slate-900">
          Organização: {preview.organization_name}
        </p>
        <p className="text-[12px] mt-1 text-slate-700">
          Ficha comercial indicada: {preview.local_company_name}
        </p>
        <p className="text-[12px] mt-1 text-slate-700">
          Papel proposto: {relationshipLabel[preview.relationship_type]}
        </p>
        <p className="text-[11px] mt-1 text-slate-600">
          Convite válido até {new Date(preview.expires_at).toLocaleDateString('pt-PT')}
        </p>
      </div>}
      <p className="text-[11px] text-slate-500 mt-3">
        Confirme a identidade e o papel comercial antes de aceitar.
        A ligação não concede acesso aos dados privados da sua empresa.
      </p>
      {error&&<p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
    </WorkspaceDialog>
    <ConfirmActionDialog open={Boolean(revokeId)} busy={busy} danger
      title="Revogar relação comercial?"
      description="A ligação deixa de aparecer como ativa para ambas as organizações."
      confirmLabel="Revogar ligação"
      onClose={()=>setRevokeId(null)} onConfirm={()=>{void revoke();}}>
      <p>Esta ação não apaga os clientes, fornecedores ou documentos já existentes em cada empresa.</p>
      {error&&<p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
    </ConfirmActionDialog>
  </section>;
}
