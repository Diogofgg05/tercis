import { useState } from 'react';
import { LockKeyhole, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';

export function PendingApprovalView() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
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

  return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
    <section className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
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
      {message && <p role="status" className="mt-5 text-sm bg-blue-50 text-blue-800 border border-blue-200 rounded-xl px-4 py-3">{message}</p>}
      <div className="mt-7 flex flex-wrap gap-3">
        <button type="button" onClick={() => {void check();}} disabled={refreshing} className="rounded-xl bg-blue-700 text-white py-2.5 px-4 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"><RefreshCw size={16}/> {refreshing ? 'A verificar…' : 'Verificar novamente'}</button>
        <button type="button" onClick={() => {void signOut();}} className="rounded-xl border border-slate-200 py-2.5 px-4 text-sm font-semibold text-slate-700 inline-flex items-center gap-2"><LogOut size={16}/> Terminar sessão</button>
      </div>
      <p className="text-xs text-slate-400 mt-7">O Tercis não concede permissões administrativas automaticamente ao criar uma conta.</p>
    </section>
  </main>;
}
