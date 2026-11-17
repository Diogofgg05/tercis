import { useCallback, useEffect, useState } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import type { Budget } from '../types';

type Delivery = {
  id: string;
  recipient_email: string;
  state: string;
  created_at: string;
  delivered_at: string | null;
  last_error: string | null;
};
const STATUS: Record<string,string> = {
  queued:'Na fila — por enviar',
  processing:'A processar',
  accepted:'Aceite pelo fornecedor (entrega não confirmada)',
  delivered:'Entregue ao servidor de email do destinatário',
  bounced:'Devolvido pelo destinatário',
  failed:'Falha na tentativa de envio',
};
export function QuoteEmailDelivery({ budget }: { budget: Budget }) {
  const { profile, demoMode } = useAuth();
  const [events,setEvents] = useState<Delivery[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const manager = Boolean(!demoMode && profile?.active
    && ['admin','company_admin'].includes(profile.role));

  const load = useCallback(async () => {
    if (!manager) return;
    const {data,error:failure}=await supabase.from('quote_email_outbox')
      .select('id,recipient_email,state,created_at,delivered_at,last_error')
      .eq('budget_id',budget.id).order('created_at',{ascending:false}).limit(5);
    if (failure) setError(failure.message);
    else setEvents((data||[]) as Delivery[]);
  },[budget.id,manager]);
  useEffect(()=>{void load();},[load]);

  async function requestDelivery() {
    if (!manager || busy || budget.archived_at || budget.status!=='enviado' || !budget.version) return;
    const recipient=(budget.company?.email||'').trim().toLowerCase();
    if(!recipient){setError('A ficha da empresa não tem email. Atualize-a antes de enviar.');return;}
    if(!window.confirm('Enviar a proposta '+budget.ref+' para '+recipient+'?\\n\\nConfirme que este é o destinatário correto.'))return;
    setBusy(true); setError(''); setNotice('');
    try {
      const {error:failure}=await supabase.rpc('tercis_queue_quote_email',{
        p_budget_id:budget.id,p_expected_version:budget.version,
        p_confirmed_recipient:recipient,
      });
      if (failure) throw failure;
      setNotice('Pedido registado. O estado «Entregue» só será mostrado após confirmação do fornecedor.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível preparar o envio.');
    } finally {setBusy(false);}
  }

  if (!manager) return null;
  return <section className="tercis-card p-4 space-y-3">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <h2 className="font-semibold text-slate-900 flex items-center gap-2">
        <Mail size={17}/> Email ao cliente
      </h2>
      <button type="button" className="tercis-button tercis-button-neutral" onClick={()=>{void load()}}>
        <RefreshCw size={14}/> Atualizar estado
      </button>
    </div>
    <p className="text-xs text-slate-600">A publicação no portal não significa que o email foi entregue.</p>
    <p className="text-xs text-slate-600">
      Destinatário confirmado na ficha da empresa: <strong>{budget.company?.email || 'Não definido'}</strong>.
    </p>
    {budget.client_email && budget.company?.email &&
      budget.client_email.trim().toLowerCase()!==budget.company.email.trim().toLowerCase() &&
      <p role="alert" className="text-xs text-amber-800">
        O email de contacto do orçamento é diferente do email comercial da empresa.
        O envio utiliza apenas o email da ficha da empresa.
      </p>}
    <button type="button" className="tercis-button tercis-button-primary"
      disabled={busy || budget.status!=='enviado' || Boolean(budget.archived_at)}
      onClick={()=>{void requestDelivery();}}>
      <Mail size={15}/>{busy?'A registar…':'Colocar email na fila'}
    </button>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
    {!events.length ? <p className="text-xs text-slate-500">Sem envios registados.</p> :
      <ul className="divide-y divide-slate-100">
        {events.map(item=><li key={item.id} className="text-xs py-2 space-y-1">
          <p className="font-semibold break-all">{item.recipient_email}</p>
          <p>{STATUS[item.state] || item.state}</p>
          {item.last_error && <p className="text-red-700">{item.last_error}</p>}
        </li>)}
      </ul>}
  </section>;
}
