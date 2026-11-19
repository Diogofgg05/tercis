import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { MFASettings } from '../components/MFASettings';

/**
 * MFA is enforced at the app gate, not only shown as a settings toggle.
 * Users with aal2 as the next assurance level must verify TOTP after login.
 * The backend must ALSO enforce aal2 RLS for sensitive resources where needed.
 */
export function MFAGate({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const privileged = profile?.active === true && (profile.platform_admin===true||['admin','company_admin','app_admin'].includes(profile.role));
  const [needsSetup,setNeedsSetup] = useState(false);
  const [recheckKey,setRecheckKey] = useState(0);
  const [required, setRequired] = useState<boolean | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    setRequired(null);
    setNeedsSetup(false);
    setFactorId('');
    setError('');
    (async () => {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (assurance.data.currentLevel === 'aal2') {
        if (active) setRequired(false);
        return;
      }
      if (assurance.data.nextLevel !== 'aal2') {
        if (active) {
          setNeedsSetup(Boolean(privileged));
          setRequired(Boolean(privileged));
        }
        return;
      }
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const first = factors.data.totp.find(factor => factor.status === 'verified');
      if (!first) {
        if (active) { setNeedsSetup(true); setRequired(true); }
        return;
      }
      if (active) { setFactorId(first.id); setRequired(true); }
    })().catch(cause => {
      if (active) { setRequired(true); setError(cause instanceof Error ? cause.message : 'Não foi possível verificar o estado de segurança.'); }
    });
    return () => { active = false; };
  }, [session?.user.id, profile?.role, profile?.active, privileged, recheckKey]);

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError('Introduza o código válido de seis dígitos.'); return;
    }
    setVerifying(true); setError('');
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (result.error) throw result.error;
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== 'aal2')
        throw assurance.error || new Error('O segundo fator ainda não foi confirmado.');
      setCode(''); setRequired(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível verificar o código.');
    } finally { setVerifying(false); }
  }

  if (required === false) return <>{children}</>;

  if (needsSetup) return <main className="tercis-auth min-h-screen bg-[#f5f7fa] flex items-center justify-center p-5">
    <section className="tercis-auth-panel w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Verificação de dois fatores obrigatória</h1>
      <p className="text-sm text-slate-600">Para proteger os dados da organização, as contas administrativas precisam de confirmar um segundo fator antes de aceder ao Tercis.</p>
      <MFASettings demoMode={false}/>
      <button type="button" onClick={()=>setRecheckKey(key=>key+1)}
        className="tercis-button tercis-button-neutral">Já configurei o 2FA — verificar novamente</button>
    </section>
  </main>;

  if (required === null) return <main className="tercis-auth min-h-screen grid place-items-center bg-[#f5f7fa] text-slate-600">
    <div className="text-center"><ShieldCheck size={32} className="mx-auto text-blue-700 mb-4"/>
      <p className="text-sm font-medium">A verificar a segurança da sessão…</p></div>
  </main>;

  return <main className="tercis-auth min-h-screen bg-[#f5f7fa] grid place-items-center p-5">
    <section className="tercis-auth-panel w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 mb-6"><KeyRound size={27}/></div>
      <h1 className="font-bold text-2xl tracking-tight text-slate-900">Verificação de segurança</h1>
      <p className="text-sm text-slate-500 mt-3 mb-6">Introduza o código de 6 dígitos da aplicação autenticadora associada à sua conta Tercis.</p>
      <label className="block text-sm font-semibold text-slate-700">
        Código TOTP
        <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6}
          value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="000000" className="tercis-input mt-2 text-xl tracking-[.32em] font-mono"/>
      </label>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{error}</p>}
      <button type="button" onClick={()=>{void verify()}} disabled={verifying || code.length !== 6 || !factorId}
        className="tercis-button tercis-button-primary mt-5 w-full min-h-[44px] disabled:opacity-50">
        {verifying ? 'A verificar…' : 'Confirmar código'}
      </button>
      <button type="button" onClick={()=>setRecheckKey(key=>key+1)} className="mt-4 w-full text-xs text-blue-700 underline">Verificar segurança novamente</button>
      <p className="mt-5 text-center text-xs text-slate-500">Não partilhe o código com ninguém. Se perdeu o autenticador, contacte o administrador da sua organização.</p>
    </section>
  </main>;
}
