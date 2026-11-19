import { useCallback,useEffect,useRef,useState } from 'react';
import { ArrowLeft,Building2,Check,CheckCheck,Download,FileText,Loader2,MessageCircle,Paperclip,Phone,RefreshCw,Search,Send,Users,Video,X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabase';
import { CHAT_BUCKET,downloadChatFile,errorMessage,FILE_TYPES } from '../../lib/messaging';
import type { ChatContact,DirectMessage } from '../../lib/messaging';
import { ProfileImage } from '../../components/ProfileImage';
import { useCalls } from '../../auth/CallContext';
import { mergeMessages } from '../../lib/chatSync';
import { ChatContactsDialog } from '../../components/ChatContactsDialog';

const PAGE_SIZE=50;
export function DirectChatView({onOpenTeam,initialPeerId,initialPeerRequest=0}:{onOpenTeam?:()=>void;initialPeerId?:string|null;initialPeerRequest?:number}) {
 const {profile,demoMode}=useAuth();const calls=useCalls();
 const [contacts,setContacts]=useState<ChatContact[]>([]);const [selected,setSelected]=useState<string|null>(null);
 const [messages,setMessages]=useState<DirectMessage[]>([]);const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [file,setFile]=useState<File|null>(null);const [query,setQuery]=useState('');
 const [scope,setScope]=useState<'all'|'internal'|'external'>('all');const [loading,setLoading]=useState(true);
 const [historyLoading,setHistoryLoading]=useState(false);const [more,setMore]=useState(false);
 const [sending,setSending]=useState(false);const [error,setError]=useState('');const [connected,setConnected]=useState(false);
 const [previews,setPreviews]=useState<Record<string,DirectMessage>>({});
 const [contactsOpen,setContactsOpen]=useState(false);
 const [contactRequests,setContactRequests]=useState(0);
 const endRef=useRef<HTMLDivElement>(null);const selectedRef=useRef(selected);selectedRef.current=selected;
 const inputRef=useRef<HTMLInputElement>(null);const request=useRef(0);const contactRequest=useRef(0);
 const historyRef=useRef<HTMLDivElement>(null);
 const userId=profile?.id;
 const current=contacts.find(c=>c.id===selected);const draft=selected?drafts[selected]||'':'';
 const appliedPeer=useRef<string|null>(null);
 useEffect(()=>{
  if(initialPeerId&&appliedPeer.current!==initialPeerId+':'+initialPeerRequest&&contacts.some(contact=>contact.id===initialPeerId)){
   appliedPeer.current=initialPeerId+':'+initialPeerRequest;setSelected(initialPeerId);
  }
 },[initialPeerId,initialPeerRequest,contacts]);

 const loadContacts=useCallback(async()=>{
  const token=++contactRequest.current;
  if(demoMode){setLoading(false);return;}
  try {
   const {data,error:failure}=await supabase.rpc('tercis_chat_contacts');if(failure)throw failure;
   if(token!==contactRequest.current)return;
   const rows=(data||[]) as ChatContact[];setContacts(rows);
   const {data:pending}=await supabase.rpc('tercis_chat_contact_requests');
   if(token!==contactRequest.current)return;
   setContactRequests(((pending||[]) as {direction:string;status:string}[]).filter(r=>r.direction==='incoming'&&r.status==='pending').length);
   // Remove an open conversation immediately if its relationship was revoked.
   setSelected(previous=>previous&&rows.some(c=>c.id===previous)?previous:null);
   const {data:latest,error:latestError}=await supabase.from('tercis_direct_messages').select('*').order('created_at',{ascending:false}).limit(200);
   if(latestError)throw latestError;
   if(token!==contactRequest.current)return;
   const index:Record<string,DirectMessage>={};
   for(const row of (latest||[]) as DirectMessage[]){const peer=row.sender_id===profile?.id?row.recipient_id:row.sender_id;if(!index[peer])index[peer]=row;}
   setPreviews(index);
  }catch(cause){if(token===contactRequest.current)setError(errorMessage(cause));}
  finally{if(token===contactRequest.current)setLoading(false);}
 },[demoMode,profile?.id]);

 const loadHistory=useCallback(async(peer:string,before?:DirectMessage,scroll=true)=>{
  if(!userId)return;
  const token=++request.current;setHistoryLoading(true);
  try {
   let result=supabase.from('tercis_direct_messages').select('*')
    .in('sender_id',[userId,peer]).in('recipient_id',[userId,peer])
    .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(PAGE_SIZE);
   if(before)result=result.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
   const {data,error:failure}=await result;if(failure)throw failure;
   if(token!==request.current||selectedRef.current!==peer)return;
   const rows=((data||[]) as DirectMessage[]).reverse();setMore(rows.length===PAGE_SIZE);
   setMessages(previous=>mergeMessages(previous,rows));
   if(!before&&scroll)window.requestAnimationFrame(()=>endRef.current?.scrollIntoView({block:'nearest'}));
  }catch(cause){if(token===request.current)setError(errorMessage(cause));}
  finally{if(token===request.current)setHistoryLoading(false);}
 },[userId]);

 useEffect(()=>{const counter=contactRequest;void loadContacts();return()=>{counter.current++;};},[loadContacts]);
 useEffect(()=>{
  setMessages([]);setFile(null);setError('');setMore(false);
  if(selected)void loadHistory(selected);
  const counter=request;return()=>{counter.current++;};
 },[selected,loadHistory]);
 useEffect(()=>{
  if(demoMode||!profile?.id)return;
  const channel=supabase.channel(`tercis-inbox:${profile.id}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'tercis_direct_messages'},payload=>{
    const row=payload.new as DirectMessage;const peer=row.sender_id===profile.id?row.recipient_id:row.sender_id;
    if(!row.id)return;
    setPreviews(previous=>!previous[peer]||previous[peer].created_at<=row.created_at?{...previous,[peer]:mergeMessages(previous[peer]?[previous[peer]]:[],[row]).slice(-1)[0]}:previous);
    if(selectedRef.current===peer){const history=historyRef.current;const atBottom=history&&history.scrollHeight-history.scrollTop-history.clientHeight<120;setMessages(previous=>mergeMessages(previous,[row]));if(payload.eventType==='INSERT'&&atBottom)window.requestAnimationFrame(()=>endRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'}));}
   }).subscribe(status=>{setConnected(status==='SUBSCRIBED');if(status==='SUBSCRIBED'){void loadContacts();if(selectedRef.current)void loadHistory(selectedRef.current,undefined,false);}});
  const onFocus=()=>{void loadContacts();if(selectedRef.current)void loadHistory(selectedRef.current,undefined,false);};
  window.addEventListener('focus',onFocus);
  const poll=window.setInterval(()=>{if(document.visibilityState==='visible'){void loadContacts();if(selectedRef.current)void loadHistory(selectedRef.current,undefined,false);}},5000);
  return()=>{window.clearInterval(poll);void supabase.removeChannel(channel);window.removeEventListener('focus',onFocus);};
 },[profile?.id,demoMode,loadContacts,loadHistory]);

 // A receipt means the received bubble entered the visible conversation while
 // this window had focus; merely loading history in a background tab is not a read.
 useEffect(()=>{
  if(!selected||!userId||demoMode||calls.busy||!historyRef.current)return;
  const peer=selected;let alive=true;let timer:number|undefined;let writing=false;
  const visible=new Set<string>();const pending=new Set(messages.filter(m=>m.sender_id===peer&&m.recipient_id===userId&&!m.read_at).map(m=>m.id));
  if(!pending.size)return;
  async function flush(){
   if(!alive||writing||document.visibilityState!=='visible'||!document.hasFocus())return;
   const ids=[...visible].filter(id=>pending.has(id)).slice(0,100);if(!ids.length)return;
   writing=true;
   try{
    const {data,error:failure}=await supabase.rpc('tercis_mark_direct_messages_read',{p_peer:peer,p_message_ids:ids});
    if(failure||!alive)return;
    const receipts=new Map(((data||[]) as {id:string;read_at:string}[]).map(r=>[r.id,r.read_at]));
    ids.forEach(id=>pending.delete(id));
    if(selectedRef.current===peer)setMessages(previous=>previous.map(m=>receipts.has(m.id)?{...m,read_at:receipts.get(m.id)!}:m));
    setPreviews(previous=>previous[peer]&&receipts.has(previous[peer].id)?{...previous,[peer]:{...previous[peer],read_at:receipts.get(previous[peer].id)!}}:previous);
   }catch{/* Retry on the next visible history update or focus event. */}finally{writing=false;}
  }
  const schedule=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>{void flush();},120);};
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const id=(entry.target as HTMLElement).dataset.messageId;if(id){if(entry.isIntersecting)visible.add(id);else visible.delete(id);}}schedule();},{root:historyRef.current,threshold:0.01});
  historyRef.current.querySelectorAll<HTMLElement>('[data-message-id]').forEach(el=>{if(el.dataset.messageId&&pending.has(el.dataset.messageId))observer.observe(el);});
  window.addEventListener('focus',schedule);document.addEventListener('visibilitychange',schedule);
  return()=>{alive=false;observer.disconnect();window.clearTimeout(timer);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',schedule);};
 },[selected,userId,messages,demoMode,calls.busy]);

 async function send() {
  if(!current||!profile||sending||(!draft.trim()&&!file))return;
  const recipient=current.id;const text=draft;const attachment=file;let path:string|null=null;let committed=false;
  setSending(true);setError('');
  try {
   if(attachment){
    if(!FILE_TYPES.includes(attachment.type)||attachment.size>10*1024*1024)throw new Error('Envia PDF, JPG, PNG, WebP ou TXT até 10 MB.');
    path=`${profile.id}/${recipient}/${crypto.randomUUID()}/${attachment.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'ficheiro'}`;
    const {error:uploadError}=await supabase.storage.from(CHAT_BUCKET).upload(path,attachment,{contentType:attachment.type,upsert:false});if(uploadError)throw uploadError;
   }
   const {error:failure}=await supabase.rpc('tercis_send_direct_message',{p_recipient:recipient,p_body:text,p_attachment_path:path,p_attachment_name:attachment?.name||null,p_attachment_type:attachment?.type||null});
   if(failure)throw failure;committed=true;
   setDrafts(previous=>previous[recipient]===text?{...previous,[recipient]:''}:previous);
   if(selectedRef.current===recipient){setFile(previous=>previous===attachment?null:previous);void loadHistory(recipient);}
   void loadContacts();
  }catch(cause){
   if(selectedRef.current===recipient)setError(errorMessage(cause));
   if(path&&!committed)await supabase.storage.from(CHAT_BUCKET).remove([path]);
  }finally{setSending(false);}
 }
 function chooseFile(candidate?:File){
  if(!candidate)return;
  if(!FILE_TYPES.includes(candidate.type)||candidate.size>10*1024*1024){setError('Envia PDF, JPG, PNG, WebP ou TXT até 10 MB.');return;}
  setFile(candidate);setError('');
 }
 const filtered=contacts.filter(c=>(scope==='all'||c.external===(scope==='external'))&&`${c.full_name} ${c.organization_name}`.toLocaleLowerCase('pt-PT').includes(query.toLocaleLowerCase('pt-PT')))
  .sort((a,b)=>(previews[b.id]?.created_at||'').localeCompare(previews[a.id]?.created_at||''));
 return <div className="direct-chat">
  <ChatContactsDialog open={contactsOpen} onClose={()=>setContactsOpen(false)} onChanged={loadContacts}/>
  <aside className={`chat-directory ${selected?'chat-mobile-hide':''}`}>
   <div className="chat-directory-heading"><div><h2>A tua caixa de entrada</h2><p>{contacts.length} contactos disponíveis</p></div><button type="button" onClick={()=>{void loadContacts();}} aria-label="Atualizar contactos" className="chat-icon-button"><RefreshCw size={18}/></button></div>
   <button type="button" className="chat-add-contact" disabled={demoMode} onClick={()=>setContactsOpen(true)}><Users size={16}/> Contactos e pedidos{contactRequests>0&&<strong className="chat-contact-count">{contactRequests}</strong>}</button>
   <label className="chat-search"><Search size={18}/><input type="search" placeholder="Procurar pessoa ou empresa" aria-label="Procurar contactos" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <div className="chat-filters" role="group" aria-label="Filtrar contactos">{([['all','Todos'],['internal','A minha empresa'],['external','Outras empresas']] as const).map(([value,label])=><button key={value} aria-pressed={scope===value} onClick={()=>setScope(value)}>{label}</button>)}</div>
   <div className="chat-contacts">
    {loading?<p className="chat-placeholder" role="status">A carregar contactos…</p>:filtered.length===0?<div className="chat-placeholder"><Users size={28}/><strong>{query?'Nenhum contacto encontrado':'Ainda sem contactos'}</strong><p>Os colegas ativos aparecem aqui. Para conversar com outra empresa, um administrador deve aceitar a ligação em Clientes e fornecedores.</p></div>:
     filtered.map(contact=><button key={contact.id} type="button" onClick={()=>setSelected(contact.id)} className={`chat-contact ${selected===contact.id?'is-selected':''}`}>
      <ProfileImage path={contact.avatar_url} name={contact.full_name}/><span className="chat-contact-copy"><strong>{contact.full_name}</strong><span>{contact.external?<Building2 size={12}/>:<Users size={12}/>} {contact.organization_name}</span><small>{previews[contact.id]?.body|| (previews[contact.id]?.attachment_name?`Anexo: ${previews[contact.id].attachment_name}`:contact.job_title||'Iniciar conversa')}</small></span>
     </button>)}
   </div>
   <div className="chat-connection"><span className={connected?'is-connected':''}/>{demoMode?'Disponível na conta real':connected?'Mensagens em tempo real':'A ligar às mensagens…'}</div>
  </aside>
  <section className={`chat-conversation ${!selected?'chat-mobile-hide':''}`}>
   {current?<>
    <header className="chat-conversation-heading"><button className="chat-icon-button md:hidden" aria-label="Voltar aos contactos" onClick={()=>setSelected(null)}><ArrowLeft size={20}/></button><ProfileImage path={current.avatar_url} name={current.full_name}/><div className="min-w-0 flex-1"><h2>{current.full_name}</h2><p>{current.organization_name} · {current.external?'Empresa parceira':'A tua empresa'}</p></div>
     <button type="button" className="chat-icon-button" title={calls.available?'Chamada de voz':'A aguardar ligação às chamadas'} aria-label="Iniciar chamada de voz" disabled={!calls.available||calls.busy} onClick={()=>{void calls.start(current,'audio');}}><Phone size={20}/></button>
     <button type="button" className="chat-icon-button" title="Videochamada" aria-label="Iniciar videochamada" disabled={!calls.available||calls.busy} onClick={()=>{void calls.start(current,'video');}}><Video size={21}/></button>
    </header>
    <div ref={historyRef} className="chat-history" role="log" aria-label="Histórico da conversa" aria-live="polite">
     <div className="chat-history-intro"><span>Uma conversa, trabalho em conjunto.</span><p>As mensagens e os ficheiros são partilhados apenas entre os dois participantes.</p></div>
     {more&&<button type="button" className="chat-load-more" disabled={historyLoading} onClick={()=>{void loadHistory(current.id,messages[0]);}}>Carregar mensagens anteriores</button>}
     {historyLoading&&messages.length===0?<p className="chat-placeholder">A carregar mensagens…</p>:messages.map(message=><article key={message.id} data-message-id={message.id} className={`chat-message ${message.sender_id===profile?.id?'is-own':''}`}>
      <div className="chat-message-bubble">{message.body&&<p>{message.body}</p>}{message.attachment_path&&<button type="button" className="chat-attachment" onClick={()=>{void downloadChatFile(message).catch(cause=>setError(errorMessage(cause)));}}><FileText size={24}/><span><strong>{message.attachment_name}</strong><small>Descarregar ficheiro</small></span><Download size={18}/></button>}</div>
      <div className="chat-message-meta"><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('pt-PT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</time>{message.sender_id===profile?.id&&<span className={`chat-read-receipt ${message.read_at?'is-read':''}`} title={message.read_at?`Vista em ${new Date(message.read_at).toLocaleString('pt-PT')}`:'Mensagem enviada'}>{message.read_at?<CheckCheck size={14}/>:<Check size={13}/>} {message.read_at?'Visto':'Enviada'}</span>}</div>
     </article>)}<div ref={endRef}/>
    </div>
    <form className="chat-composer" onSubmit={e=>{e.preventDefault();void send();}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseFile(e.dataTransfer.files[0]);}}>
     {error&&<p className="chat-error" role="alert">{error}</p>}
     {file&&<div className="chat-file-selection"><FileText size={18}/><span>{file.name} · {(file.size/1024).toFixed(0)} KB</span><button type="button" aria-label="Retirar anexo" onClick={()=>setFile(null)} disabled={sending}><X size={17}/></button></div>}
     <div className="chat-composer-row"><input ref={inputRef} type="file" className="sr-only" tabIndex={-1} accept={FILE_TYPES.join(',')} onChange={e=>{chooseFile(e.target.files?.[0]);e.target.value='';}}/>
      <button type="button" disabled={sending} className="chat-icon-button" aria-label="Anexar ficheiro" onClick={()=>inputRef.current?.click()}><Paperclip size={21}/></button>
      <textarea aria-label="Mensagem" placeholder="Escreve uma mensagem…" rows={2} maxLength={4000} disabled={demoMode} value={draft} onChange={e=>setDrafts(previous=>({...previous,[current.id]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
      <button type="submit" aria-label="Enviar mensagem" disabled={sending||(!draft.trim()&&!file)||demoMode} className="chat-send">{sending?<Loader2 size={20} className="animate-spin"/>:<Send size={20}/>}</button>
     </div><div className="chat-composer-hint"><span>Enter para enviar · Shift + Enter para nova linha</span><span>{draft.length}/4000</span></div>
    </form>
   </>:<div className="chat-welcome"><div><MessageCircle size={42}/></div><span className="tercis-eyebrow">CONVERSAS QUE APROXIMAM</span><h2>O próximo passo começa<br/>com uma conversa.</h2><p>Fala com a tua equipa, troca ficheiros e liga-te aos teus clientes e fornecedores.</p><div className="chat-welcome-features"><span><Paperclip size={17}/> Ficheiros</span><span><Phone size={17}/> Voz</span><span><Video size={18}/> Vídeo</span></div>{!loading&&contacts.length===0&&<div className="chat-first-contact"><p>Para fazer uma chamada, precisas de outro utilizador ativo. Os dois devem ter a plataforma aberta.</p>{onOpenTeam&&['admin','company_admin'].includes(profile?.role||'')&&<button type="button" className="tercis-button tercis-button-primary" onClick={onOpenTeam}><Users size={17}/> Gerir colegas e convites</button>}</div>}{error&&<p role="alert" className="chat-error">{error}</p>}</div>}
  </section>
 </div>;
}
