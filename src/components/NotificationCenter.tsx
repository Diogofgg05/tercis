import {useCallback,useEffect,useState} from 'react';
import {Bell,MessageSquare,FileText,UserPlus,RefreshCw} from 'lucide-react';
import {useAuth} from '../auth/AuthContext';
import {supabase} from '../lib/supabase';
import {WorkspaceDialog} from './WorkspaceDialog';
import {isClientUser} from '../domain/workflow';

type Message={id:string;sender_id:string;body:string;created_at:string;attachment_name:string|null};
type Quote={id:string;ref:string;name:string;status:string;valid_until:string};
export function NotificationCenter({onChat,onBudget}:{onChat:(peer?:string)=>void;onBudget:(id:string)=>void}){
  const {profile,demoMode}=useAuth();const [open,setOpen]=useState(false);
  const [messages,setMessages]=useState<Message[]>([]);const [quotes,setQuotes]=useState<Quote[]>([]);
  const [unread,setUnread]=useState(0);const [requests,setRequests]=useState(0);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  const load=useCallback(async()=>{
    if(demoMode||!profile?.active)return;
    setLoading(true);
    try {
      const result=await supabase.from('tercis_direct_messages').select('id,sender_id,body,created_at,attachment_name',{count:'exact'})
        .eq('recipient_id',profile.id).is('read_at',null).order('created_at',{ascending:false}).limit(10);
      if(result.error)throw result.error;
      setMessages(result.data||[]);setUnread(result.count||0);
      const contacts=await supabase.rpc('tercis_chat_contact_requests');if(contacts.error)throw contacts.error;
      setRequests((contacts.data||[]).filter((r:{direction:string;status:string})=>r.direction==='incoming'&&r.status==='pending').length);
      if(!isClientUser(profile)){
        const today=new Date();const soon=new Date(today.getTime()+7*86400000).toISOString().slice(0,10);
        const result=await supabase.from('budgets').select('id,ref,name,status,valid_until').is('archived_at',null).eq('is_example',false)
          .or(`status.eq.pendente_aprovacao,and(status.eq.enviado,valid_until.lte.${soon})`).order('updated_at',{ascending:false}).limit(10);
        if(result.error)throw result.error;setQuotes(result.data||[]);
      }
      setError('');
    } catch {setError('Não foi possível atualizar as notificações.');}
    finally{setLoading(false);}
  },[demoMode,profile]);
  useEffect(()=>{
    let alive=true;const refresh=()=>{if(alive&&document.visibilityState==='visible')void load();};refresh();
    const timer=window.setInterval(refresh,15000);window.addEventListener('focus',refresh);
    const channel=demoMode?null:supabase.channel('notifications:'+profile?.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'tercis_direct_messages',filter:'recipient_id=eq.'+profile?.id},refresh).subscribe();
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',refresh);if(channel)void supabase.removeChannel(channel);};
  },[load,demoMode,profile?.id]);
  const count=unread+requests+quotes.length;
  return <><button type="button" className="notification-trigger" aria-label={'Notificações'+(count?': '+count+' por consultar':'')} onClick={()=>{setOpen(true);void load();}}><Bell size={18}/>{count>0&&<span>{count>99?'99+':count}</span>}</button>
    <WorkspaceDialog open={open} onClose={()=>setOpen(false)} title="Notificações" description="Mensagens por ler, contactos e propostas que precisam da tua atenção." size="lg" footer={<button disabled={loading} className="tercis-button tercis-button-neutral" onClick={()=>{void load();}}><RefreshCw size={14}/> Atualizar</button>}>
      {error&&<p role="alert" className="chat-error">{error}</p>}
      {loading&&!count?<p className="text-sm text-slate-500">A consultar…</p>:<div className="notification-list">
        {requests>0&&<button onClick={()=>{setOpen(false);onChat();}}><UserPlus size={19}/><span><strong>{requests} pedidos de contacto</strong><small>Abre os contactos nas mensagens para aceitar ou recusar.</small></span></button>}
        {messages.map(message=><button key={message.id} onClick={()=>{setOpen(false);onChat(message.sender_id);}}><MessageSquare size={19}/><span><strong>Nova mensagem</strong><small>{message.body||message.attachment_name||'Anexo privado'}</small></span><time>{new Date(message.created_at).toLocaleDateString('pt-PT')}</time></button>)}
        {unread>messages.length&&<button onClick={()=>{setOpen(false);onChat();}}>Ver as {unread} mensagens por ler</button>}
        {quotes.map(quote=><button key={quote.id} onClick={()=>{setOpen(false);onBudget(quote.id);}}><FileText size={19}/><span><strong>{quote.ref} · {quote.name}</strong><small>{quote.status==='pendente_aprovacao'?'A aguardar revisão':'Validade: '+new Date(quote.valid_until+'T12:00:00').toLocaleDateString('pt-PT')}</small></span></button>)}
        {!count&&!error&&<p className="text-sm text-slate-500 py-5">Tudo em dia. Não existem notificações pendentes.</p>}
      </div>}
    </WorkspaceDialog></>;
}
