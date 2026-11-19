import {useState} from 'react';
import {Copy,Eye,EyeOff,KeyRound,RefreshCw,UserPlus} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {WorkspaceDialog} from './WorkspaceDialog';

export function CreateAccountDialog({open,onClose,onCreated,organizationId,organizationName,allowAdministrator=false,initialRole='collaborator'}:{open:boolean;onClose:()=>void;onCreated:()=>void|Promise<void>;organizationId?:string;organizationName?:string;allowAdministrator?:boolean;initialRole?:'collaborator'|'company_admin'}){
 const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [role,setRole]=useState<string>(initialRole);const [verified,setVerified]=useState(false);const [show,setShow]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [created,setCreated]=useState(false);
 function generate(){const bytes=crypto.getRandomValues(new Uint8Array(18));setPassword(Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')+'!Aa9');}
 async function submit(){
  if(busy||!verified)return;setBusy(true);setError('');
  try{
   const {data,error:failure}=await supabase.functions.invoke('create-team-account',{body:{full_name:name,email,password,role,organization_id:organizationId,confirm_email_ownership:verified}});
   if(failure){let message=failure.message;try{const body=await failure.context?.json();if(body?.error)message=body.error;}catch{/* Use the network error. */}throw new Error(message);}
   if(data?.error)throw new Error(data.error);
   setCreated(true);try{await onCreated();}catch{setError('Conta criada. Atualiza a lista para a veres.');}
  }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível criar a conta.');}finally{setBusy(false);}
 }
 function close(){if(busy)return;setName('');setEmail('');setPassword('');setVerified(false);setCreated(false);setError('');setRole(initialRole);setShow(false);onClose();}
 return <WorkspaceDialog open={open} onClose={close} title={created?'Conta criada e ativa':'Criar conta da empresa'} description={created?'Partilha os dados de acesso apenas com esta pessoa.':'Cria um acesso para um elemento da própria empresa. Contactos externos são adicionados nas mensagens.'} size="lg" busy={busy} footer={<><button type="button" className="tercis-button tercis-button-neutral" onClick={close} disabled={busy}>{created?'Concluir':'Cancelar'}</button>{!created&&<button type="button" className="tercis-button tercis-button-primary" disabled={busy||!verified||!name.trim()||!email.trim()||password.length<12} onClick={()=>{void submit();}}><UserPlus size={16}/>{busy?'A criar conta…':'Criar e ativar conta'}</button>}</>}>
  <div className="space-y-4">
   {organizationName&&<p className="tercis-note"><strong>Empresa:</strong> {organizationName}</p>}
   {error&&<p className="chat-error" role="alert">{error}</p>}
   {created?<div className="account-created"><span><UserPlus size={27}/></span><h3>{name}</h3><p>{email}</p><div><strong>Palavra-passe de acesso</strong><code>{password}</code><button type="button" className="tercis-button tercis-button-neutral" onClick={()=>{void navigator.clipboard.writeText(password).catch(()=>setError('Seleciona e copia a palavra-passe manualmente.'));}}><Copy size={15}/> Copiar</button></div><p>A pessoa já pode entrar. Pode alterar a palavra-passe em Definições → Segurança.</p></div>:<>
    <label className="block text-sm font-semibold text-slate-700">Nome completo<input className="tercis-input mt-2" autoComplete="off" maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="block text-sm font-semibold text-slate-700">Email profissional<input className="tercis-input mt-2" type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    {allowAdministrator&&<label className="block text-sm font-semibold text-slate-700">Papel<select className="tercis-input mt-2" value={role} onChange={e=>setRole(e.target.value)}><option value="collaborator">Colaborador</option><option value="company_admin">Administrador da empresa</option></select></label>}
    <label className="block text-sm font-semibold text-slate-700">Palavra-passe inicial<div className="account-password-field"><KeyRound size={17}/><input type={show?'text':'password'} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={128} placeholder="Pelo menos 12 caracteres"/><button type="button" aria-label={show?'Ocultar palavra-passe':'Mostrar palavra-passe'} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
    <button type="button" className="tercis-button tercis-button-neutral" onClick={generate}><RefreshCw size={15}/> Gerar palavra-passe forte</button>
    <label className="account-identity-confirmation"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/><span>Verifiquei a identidade desta pessoa e confirmo que este email lhe pertence. A conta será ativada por mim, sem envio de email de confirmação.</span></label>
   </>}
  </div>
 </WorkspaceDialog>;
}
