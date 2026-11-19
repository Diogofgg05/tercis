import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type PendingFactor = { id: string; qrCode: string; secret: string };
type VerifiedFactor = { id: string; name: string };
export function MFASettings({ demoMode }: { demoMode: boolean }) {
  const [factor, setFactor] = useState<VerifiedFactor | null>(null);
  const [pending, setPending] = useState<PendingFactor | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    if (demoMode) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const current = data.totp.find(item => item.status === 'verified') || null;
      setFactor(current ? { id: current.id, name: current.friendly_name || 'Aplicação autenticadora' } : null);
    } finally {
      // Always restore controls after a network error.
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (demoMode) { setLoading(false); return; }
    supabase.auth.mfa.listFactors().then(({data,error}) => {
      if (!active) return;
      if (error) setError(error.message);
      else {
        const item = data.totp.find(x => x.status === 'verified');
        setFactor(item ? { id: item.id, name: item.friendly_name || 'Aplicação autenticadora' } : null);
      }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível verificar o 2FA.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {active = false;};
  }, [demoMode]);

  async function enroll() {
    if (demoMode) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({factorType: 'totp', friendlyName: 'Tercis TOTP'});
      if (error) throw error;
      setPending({id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret});
      setCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a autenticação.');
    } finally {setBusy(false);}
  }

  async function verify() {
    if (!pending || !/^\d{6}$/.test(code)) { setError('Introduza o código de seis dígitos da aplicação.'); return; }
    setBusy(true); setError('');
    try {
      const {error} = await supabase.auth.mfa.challengeAndVerify({factorId: pending.id, code});
      if (error) throw error;
      setPending(null); setCode('');
      await load();
      setMessage('Autenticação de dois fatores ativada e verificada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Código inválido.');
    } finally {setBusy(false);}
  }

  async function remove() {
    if (!factor || demoMode) return;
    if (!window.confirm('Desativar a autenticação de dois fatores nesta conta?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const {error} = await supabase.auth.mfa.unenroll({factorId:factor.id});
      if (error) throw error;
      await load();
      setMessage('Autenticação de dois fatores desativada.');
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível desativar. Pode ser necessário autenticar novamente com 2FA.');
    } finally {setBusy(false);}
  }

  return <div className="space-y-5">
    <div className="flex gap-3">
      <div className="rounded-xl bg-blue-50 text-blue-700 p-3 h-fit"><ShieldCheck size={21}/></div>
      <div>
        <h3 className="text-base font-bold text-slate-900">Autenticação de dois fatores (TOTP)</h3>
        <p className="text-sm text-slate-500 mt-1">Proteja a conta usando uma aplicação autenticadora. Os códigos são verificados pelo Supabase Auth.</p>
      </div>
    </div>
    {demoMode ? <p className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">Modo demonstração: a autenticação de dois fatores requer uma conta real do Supabase e não pode ser ativada aqui.</p> :
    loading ? <p className="text-sm text-slate-500">A verificar a segurança da conta…</p> :
    factor ? <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex gap-2 items-center text-sm text-emerald-800">
        <CheckCircle2 size={19}/> <span><strong>2FA ativo</strong><span className="block text-xs mt-1">{factor.name}</span></span>
      </div>
      <button type="button" onClick={()=>{void remove()}} disabled={busy} className="tercis-button tercis-button-neutral disabled:opacity-50">Desativar 2FA</button>
    </div> :
    pending ? <div className="border border-slate-200 rounded-xl p-4 space-y-4">
      <p className="text-sm font-semibold">1. Leia o QR na aplicação autenticadora.</p>
      <div className="rounded-xl bg-white p-3 inline-block border border-slate-200">
        <img src={pending.qrCode} alt="Código QR de autenticação TOTP do Tercis" width={180} height={180}/>
      </div>
      <p className="text-xs text-slate-500">Se não conseguir ler o QR, introduza esta chave manualmente. Não a partilhe com ninguém.</p>
      <code className="block break-all rounded-lg p-3 bg-slate-100 text-xs text-slate-800 select-all">{pending.secret}</code>
      <label className="text-sm font-semibold block">2. Código da aplicação
        <input inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code"
          value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="000000" className="tercis-input block mt-2 w-44 font-mono tracking-widest"/>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>{void verify()}} disabled={busy || code.length !== 6} className="tercis-button tercis-button-primary disabled:opacity-50">Confirmar 2FA</button>
        <button type="button" onClick={()=>{setPending(null);setCode('')}} className="tercis-button tercis-button-neutral">Cancelar</button>
      </div>
    </div> : <button type="button" onClick={()=>{void enroll()}} disabled={busy} className="px-4 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"><KeyRound size={17}/> Configurar 2FA</button>}
    {!demoMode && <p className="text-xs text-slate-500 flex items-start gap-2"><LockKeyhole size={14} className="shrink-0 mt-0.5"/>O Supabase não fornece códigos de recuperação TOTP; adicione outro fator para recuperação, se necessário.</p>}
    {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
  </div>;
}
