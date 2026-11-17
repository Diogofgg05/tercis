import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Inbox, LockKeyhole, MessageSquare, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { isClientUser } from '../domain/workflow';
import type { Budget } from '../types';

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

  async function reload() {
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
  }

  useEffect(()=>{void reload();},[demoMode,profile?.id]);

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

  const selectedId=selected&&grouped.some(([id])=>id===selected)?selected:grouped[0]?.[0]||null;
  const conversation=messages.filter(item=>item.budget_id===selectedId).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  const currentBudget=budgets.find(b=>b.id===selectedId);

  return <div className="tercis-page space-y-5">
    <header className="tercis-head">
      <div><p className="tercis-eyebrow">Tercis / Comunicação</p><h1 className="tercis-title">Mensagens</h1>
        <p className="tercis-subtitle">Histórico autorizado dos orçamentos, sem conversas simuladas.</p></div>
      <button onClick={()=>{void reload()}} type="button" className="tercis-button tercis-button-neutral"><RefreshCw size={15}/> Atualizar</button>
    </header>
    <div className="tercis-note flex gap-2 items-start">
      <LockKeyhole size={16} className="mt-0.5 shrink-0"/>
      <span>Esta versão apresenta apenas mensagens existentes e autorizadas pelo servidor. O envio direto, chamadas e indicadores de presença ficam indisponíveis até serem implementados e testados.</span>
    </div>
    {error && <div role="alert" className="border border-rose-200 bg-rose-50 text-rose-700 rounded-xl text-xs p-3">{error}</div>}
    <div className="tercis-card overflow-hidden grid md:grid-cols-[minmax(230px,.36fr)_minmax(0,1fr)] min-h-[440px]">
      <aside className="border-b md:border-b-0 md:border-r border-slate-200">
        <div className="p-3 border-b border-slate-100"><label className="relative block">
          <Search size={15} className="absolute left-3 top-3 text-slate-400"/>
          <span className="sr-only">Pesquisar conversas</span>
          <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Pesquisar orçamento…" className="tercis-input pl-9"/>
        </label></div>
        {loading ? <p className="p-6 text-xs text-slate-500">A carregar mensagens…</p> :
        !grouped.length ? <div className="p-8 text-center text-slate-500"><Inbox size={28} className="mx-auto text-slate-300 mb-3"/>
          <p className="text-xs">Nenhuma conversa disponível.</p></div> :
        <div className="max-h-[580px] overflow-y-auto divide-y divide-slate-100">
          {grouped.map(([id,list])=>{const b=budgets.find(row=>row.id===id);
            return <button type="button" key={id} onClick={()=>setSelected(id)}
              className={'w-full text-left p-4 hover:bg-slate-50 '+(selectedId===id?'bg-blue-50/60':'')}>
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-blue-600 shrink-0"/>
                <strong className="text-xs truncate">{b?.name||b?.ref||'Orçamento'}</strong>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 truncate">{list[0]?.body||'Sem conteúdo'}</p>
              <p className="text-[10px] text-slate-400 mt-1">{list.length} mensagens</p>
            </button>})}
        </div>}
      </aside>
      <section className="min-w-0 flex flex-col">
        <header className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-slate-900">{currentBudget?.name||'Histórico de mensagens'}</h2>
            {currentBudget && <p className="text-[11px] text-slate-500 mt-0.5">{currentBudget.ref}</p>}</div>
          <MessageSquare size={18} className="text-slate-400"/>
        </header>
        {!conversation.length ? <div className="flex-1 flex flex-col items-center justify-center gap-2 p-10 text-center">
          <MessageSquare size={30} className="text-slate-300"/>
          <p className="text-sm font-semibold text-slate-700">Sem mensagens para mostrar</p>
          <p className="text-xs text-slate-500">Quando a integração estiver pronta, o histórico autorizado aparece aqui.</p>
        </div> : <div className="flex-1 p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[530px]">
          {conversation.map(item=><article key={item.id} className="bg-[#f6f8fb] border border-slate-100 rounded-xl px-4 py-3 max-w-[90%]">
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
              <span>{item.visibility==='internal'?'Nota interna':'Mensagem'}</span>
              <span>·</span>
              <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('pt-PT')}</time>
            </div>
            <p className="text-xs text-slate-800 whitespace-pre-wrap break-words">{item.body}</p>
          </article>)}
        </div>}
        <div className="p-3 border-t border-slate-100 bg-[#fbfcfd] text-[11px] text-slate-500">
          Envio de novas mensagens desativado nesta fase.
        </div>
      </section>
    </div>
    <button type="button" onClick={onBack} className="tercis-button tercis-button-neutral"><ArrowLeft size={15}/> Voltar ao painel</button>
  </div>;
}
export default ChatView;
