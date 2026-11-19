import { useState } from 'react';
import { LockKeyhole, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

export function PendingApprovalView() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const inactive = profile?.active === false;

  async function check() {
    setRefreshing(true);
    setMessage('');
    try {
      await refreshProfile();
      setMessage('Estado atualizado. Se continua bloqueado, contacte o administrador.');
    } catch {
      setMessage('Não foi possível consultar a conta. Verifique a ligação à internet.');
    } finally {
      setRefreshing(false);
    }
  }

  async function acceptInvite() {
    const token = inviteCode.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      setInviteError('Introduza um código de convite válido.'); return;
    }
    setClaiming(true); setInviteError(''); setMessage('');
    try {
      const {error} = await supabase.rpc('tercis_accept_organization_invite', {p_token:token});
      if (error) throw error;
      await refreshProfile();
      setInviteCode('');
      setMessage('Convite aceite. A tua conta já pertence à organização, mas continua a aguardar a aprovação do administrador.');
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : 'Não foi possível aceitar o convite.');
    } finally { setClaiming(false); }
  }

  return <main className="tercis-auth min-h-screen bg-[#f5f7fa] flex items-center justify-center p-5">
    <section className="tercis-auth-panel w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
      <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mb-6">
        {inactive ? <LockKeyhole size={28}/> : <ShieldCheck size={28}/>}
      </div>
      <h1 className="text-2xl font-bold text-slate-900">
        {inactive ? 'Conta a aguardar aprovação' : 'Perfil indisponível'}
      </h1>
      <p className="text-sm text-slate-600 leading-relaxed mt-3">
        {inactive
          ? 'O registo foi recebido, mas o acesso aos dados e às funções empresariais exige aprovação por um administrador autorizado.'
          : 'A sessão existe, mas o perfil ainda não foi carregado ou criado corretamente. Por segurança, o acesso à aplicação permanece bloqueado.'}
      </p>
      {inactive && !profile?.organization_id && <div className="mt-5 border border-slate-200 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-800">Associar à organização</h2>
        <p className="text-xs text-slate-600">Introduz o código recebido do administrador. A confirmação do email é obrigatória e o convite só pode ser usado uma vez.</p>
        <label className="block text-xs font-semibold text-slate-700">Código de convite
          <input type="text" autoComplete="off" spellCheck={false} value={inviteCode}
            onChange={event=>setInviteCode(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="tercis-input mt-2 w-full" />
        </label>
        {inviteError && <p role="alert" className="text-xs text-rose-700">{inviteError}</p>}
        <button type="button" onClick={()=>{void acceptInvite();}} disabled={claiming || !inviteCode.trim()}
          className="tercis-button tercis-button-primary disabled:opacity-50">
          {claiming ? 'A validar convite…' : 'Aceitar convite'}
        </button>
      </div>}
      {message && <p role="status" className="mt-5 text-sm bg-blue-50 text-blue-800 border border-blue-200 rounded-xl px-4 py-3">{message}</p>}
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" onClick={() => {void check();}} disabled={refreshing} className="tercis-button tercis-button-primary disabled:opacity-50"><RefreshCw size={16}/> {refreshing ? 'A verificar…' : 'Verificar novamente'}</button>
        <button type="button" onClick={() => {void signOut();}} className="tercis-button tercis-button-neutral"><LogOut size={16}/> Terminar sessão</button>
      </div>
      <p className="text-xs text-slate-400 mt-7">O Tercis não concede permissões administrativas automaticamente ao criar uma conta.</p>
    </section>
  </main>;
}
