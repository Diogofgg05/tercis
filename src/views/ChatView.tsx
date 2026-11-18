import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Inbox, LockKeyhole, MessageSquare, RefreshCw, Search, Send } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { isClientUser } from '../domain/workflow';
import type { Budget } from '../types';
import { WorkspaceEmptyState } from '../components/WorkspacePrimitives';

type Message = {
  id: string; budget_id: string; body: string; visibility: 'internal'|'client'|'both';
  sender_id: string|null; channel: string; created_at: string;
};
type Props={onBack:()=>void;budgets?:Budget[]};

export function ChatView({onBack,budgets=[]}:Props) {
  const {demoMode,profile} = useAuth();
  const [messages,setMessages]=useState<Message[]>([]);
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [loading,setLoading]=useState(!demoMode);
  const [error,setError]=useState<string|null>(null);
  const [draft,setDraft]=useState('');
  const [sending,setSending]=useState(false);

  const reload = useCallback(async () => {
    if(demoMode){setMessages([]);setLoading(false);return;}
    setLoading(true);setError(null);
    try {
      const request=isClientUser(profile)
        ? supabase.rpc('tercis_client_message_feed')
        : supabase.from('budget_messages')
          .select('id,budget_id,body,visibility,sender_id,channel,created_at')
          .order('created_at',{ascending:false}).limit(200);
      const {data,error:failure}=await request;
      if(failure)throw failure;
      setMessages((Array.isArray(data)?data:[]) as Message[]);
    } catch(reason) {
      setError(reason instanceof Error?reason.message:'Não foi possível carregar as mensagens.');
    } finally {setLoading(false);}
  },[demoMode,profile]);

  useEffect(()=>{void reload();},[reload]);

  const grouped=useMemo(()=>{
    const groups=new Map<string,Message[]>();
    for(const item of messages){
      const group=groups.get(item.budget_id)||[];
      group.push(item);groups.set(item.budget_id,group);
    }
    const term=query.toLocaleLowerCase('pt-PT').trim();
    return [...groups.entries()].filter(([id,list])=>{
      const budget=budgets.find(b=>b.id===id);
      return !term || [budget?.name,budget?.ref,list[0]?.body].some(t=>(t||'').toLocaleLowerCase('pt-PT').includes(term));
    }).sort((a,b)=>(b[1][0]?.created_at||'').localeCompare(a[1][0]?.created_at||''));
  },[messages,budgets,query]);

  const selectedId=selected&&budgets.some(item=>item.id===selected)?selected:grouped[0]?.[0]||null;
  const conversation=messages.filter(item=>item.budget_id===selectedId).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const currentBudget=budgets.find(b=>b.id===selectedId);
  const canSend=Boolean(!demoMode && profile?.active && selectedId && currentBudget
    && !currentBudget.archived_at &&
    (profile.role==='admin'||profile.role==='company_admin'||
      (profile.role==='collaborator' && profile.collaborator_type==='internal' &&
        (currentBudget.created_by===profile.id||currentBudget.assigned_to===profile.id))));
  async function sendInternalMessage(){
    if(!canSend||!selectedId||!draft.trim()||sending)return;
    setSending(true);setError(null);
    const text=draft.trim();
    try {
      const {error:failure}=await supabase.rpc('tercis_send_internal_budget_message',{
        p_budget_id:selectedId,p_body:text,
      });
      if(failure)throw failure;
      setDraft('');
      try{await reload();}
      catch{setError('Nota guardada. Atualize a conversa para consultar a nova mensagem.');}
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Não foi possível guardar a nota.');
    }finally{setSending(false);}
  }

  return <div className="tercis-page space-y-4">
    <header className="tercis-head">
      <div><p className="tercis-eyebrow">Tercis / Comunicação</p><h1 className="tercis-title">Mensagens</h1>
        <p className="tercis-subtitle">Histórico autorizado dos orçamentos, sem conversas simuladas.</p></div>
      <button onClick={()=>{void reload()}} type="button" className="tercis-button tercis-button-neutral"><RefreshCw size={15}/> Atualizar</button>
    </header>
    <div className="tercis-note flex gap-2 items-start">
      <LockKeyhole size={16} className="mt-0.5 shrink-0"/>
      <span>Notas internas podem ser enviadas pela equipa autorizada. O envio de mensagens para clientes, as chamadas e os indicadores de presença permanecem desativados.</span>
    </div>
    {error && <div role="alert" className="border border-rose-200 bg-rose-50 text-rose-700 rounded-xl text-xs p-3">{error}</div>}
    <div className="tercis-card overflow-hidden grid md:grid-cols-[minmax(250px,.34fr)_minmax(0,1fr)] min-h-[540px]">
      <aside className="bg-[#fafbfe] border-b md:border-b-0 md:border-r border-slate-200 min-w-0">
        <div className="p-3 border-b border-slate-100"><label className="relative block">
          <Search size={15} className="absolute left-3 top-3 text-slate-400"/>
          <span className="sr-only">Pesquisar conversas</span>
          <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Pesquisar orçamento…" className="tercis-input pl-9"/>
        </label></div>
        {!demoMode && !isClientUser(profile) && <div className="p-3 border-b border-slate-100">
          <label htmlFor="chat-select-budget" className="block text-[11px] font-semibold text-slate-600 mb-1">Selecionar orçamento</label>
          <select id="chat-select-budget" className="tercis-input" value={selectedId||''}
            onChange={event=>{setSelected(event.target.value||null);setDraft('');}}>
            <option value="">Escolha uma proposta</option>
            {budgets.map(b=><option key={b.id} value={b.id}>{b.ref} — {b.name}</option>)}
          </select>
        </div>}
                {loading ? <p className="p-6 text-xs text-slate-500">A carregar mensagens…</p> :
        !grouped.length ? <WorkspaceEmptyState icon={<Inbox size={23}/>}
          title="Sem conversas" description="As mensagens dos orçamentos autorizados aparecem aqui."/> :
        <div className="max-h-[580px] overflow-y-auto divide-y divide-slate-100">
          {grouped.map(([id,list])=>{const b=budgets.find(row=>row.id===id);
            return <button type="button" key={id} onClick={()=>setSelected(id)}
              aria-current={selectedId===id?'true':undefined}
              className={'w-full text-left px-4 py-3.5 border-l-[3px] transition-colors '+(selectedId===id?'border-blue-500 bg-blue-50 text-blue-900':'border-transparent hover:bg-white text-slate-700')}>
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-blue-600 shrink-0"/>
                <strong className="text-xs truncate">{b?.name||b?.ref||'Orçamento'}</strong>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 truncate">{list[0]?.body||'Sem conteúdo'}</p>
              <p className="text-[10px] text-slate-400 mt-1">{list.length} mensagens</p>
            </button>})}
        </div>}
      </aside>
      <section className="min-w-0 flex flex-col bg-white">
        <header className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
          <div><h2 className="text-sm font-semibold text-slate-900">{currentBudget?.name||'Histórico de mensagens'}</h2>
            {currentBudget && <p className="text-[11px] text-slate-500 mt-0.5">{currentBudget.ref}</p>}</div>
          <MessageSquare size={18} className="text-slate-400"/>
        </header>
        {!conversation.length ? <div className="flex-1 grid place-items-center">
          <WorkspaceEmptyState icon={<MessageSquare size={23}/>}
            title="Sem mensagens para mostrar"
            description="Selecione um orçamento com mensagens ou registe uma nota interna autorizada."/>
        </div> : <div className="flex-1 p-4 sm:p-5 space-y-3 overflow-y-auto min-h-[240px] max-h-[520px] bg-[#fcfdff]" role="log" aria-label="Histórico de mensagens">
          {conversation.map(item=><article key={item.id}
            className={'border rounded-2xl px-4 py-3 max-w-[90%] md:max-w-[75%] '+(item.sender_id===profile?.id
              ? 'ml-auto bg-[#edf5ff] border-[#d8e8ff]' : 'bg-white border-[#e8edf3]')}>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
              <span>{item.visibility==='internal'?'Nota interna':'Mensagem'}</span>
              <span>·</span>
              <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('pt-PT')}</time>
            </div>
            <p className="text-xs text-slate-800 whitespace-pre-wrap break-words">{item.body}</p>
          </article>)}
        </div>}
        {canSend ? <form onSubmit={event=>{event.preventDefault();void sendInternalMessage();}}
          className="p-3 sm:p-4 border-t border-slate-100 bg-white space-y-2">
          <label htmlFor="chat-internal-note" className="block text-xs font-semibold text-slate-700">Nota interna · não visível ao cliente</label>
          <textarea id="chat-internal-note" value={draft} rows={3} maxLength={4000}
            placeholder="Escreva uma nota para a equipa…" className="tercis-input resize-y"
            onChange={event=>setDraft(event.target.value)}
            onKeyDown={event=>{
              if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!sending&&draft.trim()){
                event.preventDefault();void sendInternalMessage();
              }
            }} />
          <div className="flex justify-end items-center gap-3">
            <span className="text-[10px] text-slate-500">Ctrl/Cmd+Enter para guardar · {draft.length}/4000</span>
            <button type="submit" disabled={sending||!draft.trim()}
              className="tercis-button tercis-button-primary disabled:opacity-50">
              <Send size={14}/>{sending?'A guardar…':'Guardar nota'}
            </button>
          </div>
        </form> : <div className="p-3 border-t border-slate-100 bg-[#fbfcfd] text-[11px] text-slate-500">
          {isClientUser(profile)?'A comunicação direta com clientes ainda não está ativada.':
            'Selecione uma proposta não arquivada para criar uma nota interna autorizada.'}
        </div>}
      </section>
    </div>
    <button type="button" onClick={onBack} className="tercis-button tercis-button-neutral"><ArrowLeft size={15}/> Voltar ao painel</button>
  </div>;
}
export default ChatView;
