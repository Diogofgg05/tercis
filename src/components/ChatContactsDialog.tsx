import {useCallback,useEffect,useState} from 'react';
import {Building2,Check,Mail,UserPlus,X} from 'lucide-react';
import {WorkspaceDialog} from './WorkspaceDialog';
import {supabase} from '../lib/supabase';
import {useAuth} from '../auth/AuthContext';

type ContactRequest={id:string;direction:'incoming'|'outgoing';status:'pending'|'accepted';full_name:string;organization_name:string};
export function ChatContactsDialog({open,onClose,onChanged}:{open:boolean;onClose:()=>void;onChanged:()=>void|Promise<void>}){
 const {profile}=useAuth();const [email,setEmail]=useState('');const [requests,setRequests]=useState<ContactRequest[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const canAdd=profile?.role==='company_admin'||profile?.role==='admin';
 const load=useCallback(async()=>{const {data,error:failure}=await supabase.rpc('tercis_chat_contact_requests');if(failure)setError(failure.message);else setRequests(data||[]);},[]);
 useEffect(()=>{if(open){void load();setError('');setNotice('');}},[open,load]);
 async function request(){setBusy(true);setError('');setNotice('');try{const {error:failure}=await supabase.rpc('tercis_request_chat_contact',{p_email:email});if(failure)throw failure;setEmail('');setNotice('Pedido enviado dentro da plataforma. A conversa fica disponível quando a pessoa aceitar.');await load();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível adicionar o contacto.');}finally{setBusy(false);}}
 async function respond(id:string,action:string){setBusy(true);setError('');try{const {error:failure}=await supabase.rpc('tercis_respond_chat_contact',{p_id:id,p_action:action});if(failure)throw failure;await load();await onChanged();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível atualizar o contacto.');}finally{setBusy(false);}}
 return <WorkspaceDialog open={open} onClose={onClose} title="Contactos e pedidos" description="Liga-te a pessoas de outras empresas sem as adicionar à tua equipa nem lhes dar acesso a dados comerciais." size="lg" busy={busy}>
  <div className="space-y-5">
   {error&&<p className="chat-error" role="alert">{error}</p>}{notice&&<p className="tercis-note" role="status">{notice}</p>}
   {canAdd&&<section className="chat-contact-invite"><h3><UserPlus size={18}/> Adicionar contacto externo</h3><p>A pessoa deve ter uma conta ativa na sua própria empresa.</p><label><Mail size={16}/><input type="email" aria-label="Email do contacto externo" value={email} onChange={e=>setEmail(e.target.value)} placeholder="pessoa@outraempresa.pt"/></label><button className="tercis-button tercis-button-primary" disabled={busy||!email.trim()} onClick={()=>{void request();}}>Enviar pedido</button></section>}
   <section className="chat-contact-requests"><h3>Pedidos e contactos pessoais</h3>{requests.length===0?<p>Ainda não existem pedidos. Os colegas da tua empresa já aparecem na lista de conversas.</p>:requests.map(item=><article key={item.id}><span><Building2 size={19}/></span><div><strong>{item.full_name}</strong><p>{item.organization_name}</p><small>{item.status==='accepted'?'Contacto aceite':item.direction==='incoming'?'Quer adicionar-te aos contactos':'A aguardar aceitação'}</small></div><div>{item.direction==='incoming'&&item.status==='pending'?<><button className="tercis-button tercis-button-primary" disabled={busy} onClick={()=>{void respond(item.id,'accept');}}><Check size={15}/> Aceitar</button><button className="chat-icon-button" aria-label="Recusar pedido" disabled={busy} onClick={()=>{void respond(item.id,'decline');}}><X size={17}/></button></>:<button className="tercis-button tercis-button-neutral" disabled={busy} onClick={()=>{void respond(item.id,'revoke');}}>{item.status==='accepted'?'Remover':'Cancelar pedido'}</button>}</div></article>)}</section>
  </div>
 </WorkspaceDialog>;
}
