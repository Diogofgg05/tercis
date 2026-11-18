import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowUpRight, FileText, Inbox, LockKeyhole, MessageSquare,
  RefreshCw, Search, Send, X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { isClientUser } from '../domain/workflow';
import { StatusBadge } from '../components/StatusBadge';
import { WorkspaceEmptyState } from '../components/WorkspacePrimitives';
import type { Budget } from '../types';
import { formatDatePt } from '../lib/formatDate';

type Message = {
  id: string; budget_id: string; body: string; visibility: 'internal'|'client'|'both';
  sender_id: string|null; channel: string; created_at: string;
};
type ThreadFilter = 'all'|'active';
type Props = {
  onBack:()=>void;
  budgets?:Budget[];
  initialBudgetId?:string|null;
  onOpenBudget?: (budget:Budget)=>void;
};

function messageTime(value:string):string {
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-PT', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'Data indisponível';
}

/** Conversation inbox scoped to budgets returned by the authenticated feed.
 * Only internal notes can be created; customer messaging is NOT simulated. */
export function ChatView({onBack,budgets=[],initialBudgetId=null,onOpenBudget}:Props){
  const {demoMode,profile}=useAuth();
  const [messages,setMessages]=useState<Message[]>([]);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<ThreadFilter>('all');
  const [selected,setSelected]=useState<string|null>(initialBudgetId);
  const [mobilePane,setMobilePane]=useState<'list'|'thread'>(initialBudgetId?'thread':'list');
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(!demoMode);
  const [refreshing,setRefreshing]=useState(false);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null);

  const reload=useCallback(async(silent=false):Promise<boolean>=>{
    if(demoMode){setMessages([]);setLoading(false);setLastUpdated(null);return true;}
    if(silent)setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result=isClientUser(profile)
        ? await supabase.rpc('tercis_client_message_feed')
        : await supabase.from('budget_messages')
          .select('id,budget_id,body,visibility,sender_id,channel,created_at')
          .order('created_at',{ascending:false}).limit(200);
      if(result.error)throw result.error;
      setMessages((Array.isArray(result.data)?result.data:[]) as Message[]);
      setLastUpdated(new Date());
      return true;
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Não foi possível consultar mensagens.');
      return false;
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  },[demoMode,profile]);

  useEffect(()=>{void reload();},[reload]);

  const threads=useMemo(()=>{
    const byBudget=new Map<string,Message[]>();
    for(const message of messages){
      const prior=byBudget.get(message.budget_id)||[];
      prior.push(message);
      byBudget.set(message.budget_id,prior);
    }
    const search=query.trim().toLocaleLowerCase('pt-PT');
    return budgets
      .filter(b=>!b.archived_at || byBudget.has(b.id))
      .map(b=>{
        const history=byBudget.get(b.id)||[];
        const latest=history[0];
        return {budget:b,history,latest};
      })
      .filter(entry=>(filter==='all'||entry.history.length>0)
        && (!search||[
          entry.budget.name,entry.budget.ref,entry.budget.company?.name,
          entry.latest?.body,
        ].some(value=>(value||'').toLocaleLowerCase('pt-PT').includes(search))))
      .sort((a,b)=>{
        const dateA=a.latest?.created_at||a.budget.created_at||a.budget.date||'';
        const dateB=b.latest?.created_at||b.budget.created_at||b.budget.date||'';
        return dateB.localeCompare(dateA);
      });
  },[budgets,messages,query,filter]);

  // Do not auto-select a conversation that exists only in the untrusted URL,
  // or is absent from the authenticated list of accessible budgets.
  const selectedId=selected&&budgets.some(b=>b.id===selected)
    ?selected:(threads[0]?.budget.id??null);
  const currentBudget=budgets.find(b=>b.id===selectedId);
  const conversation=useMemo(
    ()=>messages.filter(message=>message.budget_id===selectedId)
      .sort((a,b)=>a.created_at.localeCompare(b.created_at)),
    [messages,selectedId],
  );
  const draft=selectedId?drafts[selectedId]||'':'';
  const canSend=Boolean(!demoMode && profile?.active && currentBudget && selectedId &&
    currentBudget.company_id && !currentBudget.archived_at &&
    (profile.role==='admin'||profile.role==='company_admin'||
      (profile.role==='collaborator'&&profile.collaborator_type==='internal'&&
        (currentBudget.created_by===profile.id||currentBudget.assigned_to===profile.id))));

  function choose(id:string){
    if(!budgets.some(b=>b.id===id))return;
    setSelected(id);
    setError('');
    setNotice('');
    setMobilePane('thread');
  }

  async function sendInternalMessage(){
    const id=selectedId;
    const text=draft.trim();
    if(!canSend||!id||!text||text.length>4000||sending)return;
    setSending(true);setError('');setNotice('');
    try{
      const {error:failure}=await supabase.rpc('tercis_send_internal_budget_message',{
        p_budget_id:id,p_body:text,
      });
      if(failure)throw failure;
      // Clear only the draft that was committed, and only if it was unchanged
      // while the request was in flight. Never erase another conversation.
      setDrafts(previous=>previous[id]===draft
        ?{...previous,[id]:''}:previous);
      const refreshed=await reload(true);
      if(!refreshed)setNotice('Nota guardada. Volte a atualizar o histórico para a visualizar.');
      else setNotice('Nota interna guardada no orçamento.');
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Não foi possível guardar a nota interna.');
    }finally{setSending(false);}
  }

  return <div className="tercis-page space-y-4">
    <header className="tercis-head">
      <div>
        <p className="tercis-eyebrow">TERCIS / COMUNICAÇÃO</p>
        <h1 className="tercis-title">Mensagens</h1>
        <p className="tercis-subtitle">Notas de equipa e histórico autorizado, organizados por orçamento.</p>
      </div>
      <button type="button" disabled={loading||refreshing||sending}
        className="tercis-button tercis-button-neutral"
        onClick={()=>{void reload(true);}}>
        <RefreshCw size={15} className={refreshing?'animate-spin':''}/>
        {refreshing?'A atualizar…':'Atualizar'}
      </button>
    </header>

    <div className="flex items-start gap-2 rounded-xl px-3.5 py-3 border border-blue-100 bg-[#f3f8ff] text-[11px] leading-5 text-slate-700">
      <LockKeyhole size={16} className="text-blue-700 shrink-0 mt-0.5"/>
      <p>
        As notas internas não são visíveis aos clientes. Esta página não envia mensagens diretas, SMS ou chamadas.
        {!demoMode&&messages.length===200&&' Estão carregadas apenas as 200 mensagens mais recentes.'}
      </p>
    </div>
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">{notice}</p>}

    <div className="tercis-card overflow-hidden md:grid md:grid-cols-[minmax(275px,0.37fr)_minmax(0,1fr)] min-h-[560px]">
      <aside className={`bg-[#fafbfe] min-w-0 md:border-r border-slate-100 ${mobilePane==='thread'?'hidden md:block':'block'}`}>
        <div className="p-3.5 border-b border-slate-100 space-y-3">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-3 text-slate-400"/>
            <span className="sr-only">Pesquisar conversas</span>
            <input type="search" placeholder="Pesquisar propostas ou mensagens…"
              value={query} onChange={event=>setQuery(event.target.value)}
              className="tercis-input pl-9 pr-9"/>
            {query&&<button type="button" onClick={()=>setQuery('')}
              aria-label="Limpar pesquisa" className="absolute right-2.5 top-2.5 rounded-md p-1 text-slate-500 hover:bg-slate-100">
              <X size={15}/>
            </button>}
          </label>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Filtrar conversas" className="inline-flex rounded-lg bg-slate-100 p-0.5">
              <button type="button" aria-pressed={filter==='all'} onClick={()=>setFilter('all')}
                className={'px-3 py-1.5 rounded-md text-[11px] font-semibold '+(filter==='all'?'bg-white text-blue-700 shadow-sm':'text-slate-500')}>
                Todas
              </button>
              <button type="button" aria-pressed={filter==='active'} onClick={()=>setFilter('active')}
                className={'px-3 py-1.5 rounded-md text-[11px] font-semibold '+(filter==='active'?'bg-white text-blue-700 shadow-sm':'text-slate-500')}>
                Com mensagens
              </button>
            </div>
            <span role="status" className="text-[11px] text-slate-500 ml-auto tabular-nums">{threads.length}</span>
          </div>
        </div>
        {loading
          ? <div className="p-6 text-xs text-slate-500" role="status">A carregar conversas…</div>
          :threads.length===0
            ?<WorkspaceEmptyState icon={<Inbox size={23}/>}
              title={query?'Sem resultados':'Sem conversas disponíveis'}
              description={query?'Experimente pesquisar pela referência, cliente ou nome da proposta.':
                'Os orçamentos autorizados ficam disponíveis aqui, mesmo antes da primeira nota.'}
              action={query?<button type="button" onClick={()=>setQuery('')} className="tercis-button tercis-button-neutral">Limpar pesquisa</button>:undefined}/>
            :<div className="md:max-h-[620px] overflow-y-auto divide-y divide-slate-100">
              {threads.map(({budget,history,latest})=><button type="button" key={budget.id}
                onClick={()=>choose(budget.id)} aria-current={selectedId===budget.id?'true':undefined}
                className={`w-full text-left px-4 py-3.5 border-l-[3px] transition-colors ${selectedId===budget.id
                  ?'border-blue-600 bg-blue-50/70'
                  :'border-transparent hover:bg-white'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 grid place-items-center shrink-0 text-blue-700">
                    <FileText size={16}/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-xs text-slate-900 truncate">{budget.name||budget.ref}</strong>
                    <span className="block text-[10px] text-slate-500 truncate mt-0.5">
                      {budget.ref}{budget.company?.name?' · '+budget.company.name:''}
                    </span>
                  </div>
                  {history.length>0&&<span className="text-[10px] tabular-nums text-slate-500">{history.length}</span>}
                </div>
                <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 break-words">
                  {latest?.body||'Sem mensagens — pode iniciar uma nota interna autorizada.'}
                </p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <StatusBadge status={budget.status} size="sm"/>
                  <span className="text-[10px] text-slate-400">
                    {latest?messageTime(latest.created_at):'Sem atividade'}
                  </span>
                </div>
              </button>)}
            </div>}
      </aside>

      <section className={`flex-col min-w-0 bg-white ${mobilePane==='list'?'hidden md:flex':'flex'}`}>
        <header className="p-4 border-b border-slate-100 flex items-center gap-3">
          <button type="button" onClick={()=>setMobilePane('list')}
            className="md:hidden tercis-button tercis-button-neutral" aria-label="Voltar às conversas">
            <ArrowLeft size={16}/>
          </button>
          <span className="w-10 h-10 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl grid place-items-center shrink-0">
            <MessageSquare size={19}/>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-[13px] text-slate-900 truncate">
              {currentBudget?.name||'Selecione uma proposta'}
            </h2>
            <p className="text-[11px] text-slate-500 truncate">
              {currentBudget?currentBudget.ref+(currentBudget.company?.name?' · '+currentBudget.company.name:''):'Histórico interno autorizado'}
            </p>
          </div>
          {currentBudget&&<StatusBadge status={currentBudget.status} size="sm"/>}
          {currentBudget&&onOpenBudget&&<button type="button" onClick={()=>onOpenBudget(currentBudget)}
            className="tercis-button tercis-button-neutral hidden sm:inline-flex">
            <ArrowUpRight size={14}/> Ver proposta
          </button>}
        </header>

        {!currentBudget
          ?<div className="flex-1 grid place-items-center"><WorkspaceEmptyState icon={<MessageSquare size={23}/>}
            title="Escolha uma proposta" description="Selecione um orçamento na lista para consultar o seu histórico."/></div>
          :conversation.length===0
            ?<div className="flex-1 flex items-center justify-center bg-[#fcfdff] p-4 sm:p-6">
              <div className="max-w-[460px] w-full">
                <WorkspaceEmptyState icon={<MessageSquare size={23}/>}
                  title="Ainda não existem notas"
                  description={canSend
                    ?'Este orçamento está pronto para receber a primeira nota interna da equipa.'
                    :'Este orçamento ainda não contém mensagens disponíveis para consulta.'}/>
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[12px] font-bold text-slate-900">Contexto da proposta</h3>
                    <StatusBadge status={currentBudget.status} size="sm"/>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div className="min-w-0">
                      <span className="block text-slate-500 mb-1">Cliente</span>
                      <strong className="text-slate-800 truncate block">
                        {currentBudget.company?.name||'Não associado'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-500 mb-1">Data</span>
                      <strong className="text-slate-800">{formatDatePt(currentBudget.date)}</strong>
                    </div>
                  </div>
                  {onOpenBudget&&<button type="button" onClick={()=>onOpenBudget(currentBudget)}
                    className="tercis-button tercis-button-neutral mt-4 w-full">
                    <FileText size={14}/> Consultar orçamento <ArrowUpRight size={14}/>
                  </button>}
                </div>
              </div>
            </div>
            :<div role="log" aria-label="Histórico de mensagens"
              className="flex-1 px-4 sm:px-5 py-5 space-y-3 min-h-[220px] max-h-[540px] overflow-y-auto bg-[#fcfdff]">
              {conversation.map(message=><article key={message.id}
                className={'w-fit min-w-[140px] max-w-[92%] sm:max-w-[78%] rounded-2xl border p-3.5 '+
                  (message.sender_id===profile?.id
                    ?'ml-auto bg-blue-50 border-blue-100'
                    :'bg-white border-slate-200 shadow-sm')}>
                <div className="flex items-center flex-wrap gap-1.5 text-[10px] text-slate-500 mb-2">
                  <LockKeyhole size={12}/>
                  <span>{message.visibility==='internal'?'Nota interna':'Mensagem autorizada'}</span>
                  <span>·</span>
                  <time dateTime={message.created_at}>{messageTime(message.created_at)}</time>
                </div>
                <p className="text-[12px] text-slate-800 leading-5 whitespace-pre-wrap break-words">{message.body}</p>
              </article>)}
            </div>}

        {canSend&&currentBudget
          ?<form onSubmit={event=>{event.preventDefault();void sendInternalMessage();}}
            className="p-3.5 sm:p-4 border-t border-slate-100 bg-white space-y-2">
            <label htmlFor="chat-internal-note" className="flex gap-2 items-center text-[12px] font-semibold text-slate-700">
              <LockKeyhole size={14} className="text-blue-600"/> Nota interna · só para a equipa
            </label>
            <textarea id="chat-internal-note" maxLength={4000} value={draft} rows={3}
              placeholder="Escreva uma nota sobre esta proposta…"
              className="tercis-input resize-y"
              onChange={event=>setDrafts(previous=>({...previous,[currentBudget.id]:event.target.value}))}
              onKeyDown={event=>{
                if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!sending&&draft.trim()){
                  event.preventDefault();void sendInternalMessage();
                }
              }}/>
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="text-[10px] text-slate-500">Ctrl/Cmd+Enter · {draft.length}/4000</span>
              <button type="submit" disabled={sending||!draft.trim()}
                className="tercis-button tercis-button-primary disabled:opacity-50">
                {sending?<RefreshCw size={14} className="animate-spin"/>:<Send size={14}/>}
                {sending?'A guardar…':'Guardar nota'}
              </button>
            </div>
          </form>
          :<div className="px-4 py-3 border-t border-slate-100 bg-[#fbfcfe] text-[11px] text-slate-500">
            {demoMode?'Demonstração: as mensagens não são gravadas.'
              :isClientUser(profile)?'A comunicação direta com clientes ainda não está ativa.'
              :'Escolha uma proposta não arquivada, com cliente associado, para guardar uma nota.'}
          </div>}
        <footer className="px-4 py-2 border-t border-slate-100 flex justify-between gap-2 text-[10px] text-slate-400">
          <span>{lastUpdated?'Atualizado às '+lastUpdated.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}):'Sem atualização recente'}</span>
          <span>{conversation.length} {conversation.length===1?'mensagem':'mensagens'} carregadas</span>
        </footer>
      </section>
    </div>

    <button type="button" onClick={onBack}
      className="tercis-button tercis-button-neutral"><ArrowLeft size={15}/> Voltar ao painel</button>
  </div>;
}
export default ChatView;
