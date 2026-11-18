import { useState } from 'react';
import { ArrowRight, BookOpen, Eye, EyeOff, FileText, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from './AuthContext';
import { DEMO_PASSWORD } from '../demoData';
import { supabase } from '../lib/supabase';

export function LoginView() {
  const {signIn,signUp,demoMode}=useAuth();
  const [mode,setMode]=useState<'login'|'register'|'reset'>('login');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [name,setName]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if(!email.trim()){setError('Introduza o seu email.');return;}
    if(mode!=='reset' && !password){setError('Introduza a palavra-passe.');return;}
    if(mode==='register' && (!name.trim()||password.length<12)){setError('Indique o nome e uma palavra-passe com pelo menos 12 caracteres.');return;}
    setBusy(true);setError('');setMessage('');
    try {
      if(mode==='reset') {
        if(demoMode){setError('Recuperação indisponível na demonstração.');return;}
        const {error:failure}=await supabase.auth.resetPasswordForEmail(email.trim(),{
          redirectTo:window.location.origin,
        });
        if(failure)throw failure;
        setMessage('Se existir uma conta com este email, receberá uma ligação de recuperação. Após abrir a ligação, defina uma palavra-passe nova em Definições > Segurança.');
        return;
      }
      const result=mode==='login'
        ? await signIn(email.trim(),password)
        : await signUp(email.trim(),password,name.trim());
      if(result)setError(result);
      else if(mode==='register')setMessage('Registo recebido. Após confirmar o email, a conta ficará pendente da aprovação por um administrador autorizado.');
    } catch(reason) {
      setError(reason instanceof Error?reason.message:'Não foi possível contactar o serviço de autenticação.');
    } finally {setBusy(false);}
  }

  return <main className="tercis-auth min-h-dvh bg-[#f5f7fa] flex items-center justify-center px-4 py-8 sm:p-8">
    <div className="w-full max-w-[1040px] grid lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,.95fr)] overflow-hidden bg-white border border-[#e4e7eb] rounded-[24px] shadow-[0_14px_50px_rgba(30,41,59,.07)]">
      <section className="px-6 py-8 sm:p-10 lg:p-12 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <span className="w-10 h-10 rounded-xl bg-[#1673e6] text-white font-black text-xl flex items-center justify-center">T</span>
          <span className="font-bold tracking-tight text-xl text-slate-900">Tercis</span>
          <span className="ml-auto text-[10px] uppercase tracking-[.14em] font-bold text-slate-400">Workspace</span>
        </div>
        <div className="mb-7">
          <p className="tercis-eyebrow mb-2">Acesso à plataforma</p>
          <h1 className="text-3xl sm:text-[34px] leading-tight tracking-[-.04em] font-bold text-slate-900">{mode==='login'?'Bem-vindo de volta':mode==='reset'?'Recuperar acesso':'Criar conta'}</h1>
          <p className="text-sm text-slate-500 mt-2 leading-6">{mode==='login'?'Aceda aos seus orçamentos, clientes e documentos.':mode==='reset'?'Enviaremos instruções para o seu email, caso exista uma conta.':'O acesso a dados empresariais depende de aprovação após o registo.'}</p>
        </div>
        <form onSubmit={e=>{void submit(e)}} className="space-y-4">
          {mode==='register' && <label className="block text-xs font-semibold text-slate-700">Nome completo
            <input type="text" autoComplete="name" value={name} onChange={e=>setName(e.target.value)}
              placeholder="Nome completo" required className="tercis-input mt-2"/>
          </label>}
          <label className="block text-xs font-semibold text-slate-700">Email
            <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="Email" required className="tercis-input mt-2"/>
          </label>
          {mode!=='reset' && <label className="block text-xs font-semibold text-slate-700">Palavra-passe
            <span className="relative block mt-2">
              <input type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'}
                value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" required
                className="tercis-input pr-12"/>
              <button type="button" onClick={()=>setShowPassword(value=>!value)}
                aria-label={showPassword?'Ocultar palavra-passe':'Mostrar palavra-passe'}
                aria-pressed={showPassword} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                {showPassword?<EyeOff size={17}/>:<Eye size={17}/>}
              </button>
            </span>
          </label>}
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs p-3">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-xs p-3">{message}</p>}
          <button type="submit" disabled={busy}
            className="tercis-button tercis-button-primary w-full min-h-[45px] text-[13px] disabled:opacity-50">
            {busy?'A validar…':mode==='login'?'Iniciar Sessão':mode==='reset'?'Enviar ligação de recuperação':'Registar e aguardar aprovação'}<ArrowRight size={17}/>
          </button>
          {!demoMode && mode==='login' && <p className="text-right text-xs">
            <button type="button" className="font-semibold text-blue-700 hover:underline"
              onClick={()=>{setMode('reset');setError('');setMessage('');}}>Esqueceu-se da palavra-passe?</button>
          </p>}
          {!demoMode && mode==='reset' && <button type="button"
            className="w-full text-center text-xs font-semibold text-blue-700 hover:underline"
            onClick={()=>{setMode('login');setError('');setMessage('');}}>Voltar ao início de sessão</button>}
          {!demoMode && mode!=='reset' && <p className="text-center text-xs text-slate-500">
            {mode==='login'?'Ainda não tem conta?':'Já tem conta?'}
            {' '}<button type="button" className="font-semibold text-blue-700 hover:underline" onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setMessage('');}}>
              {mode==='login'?'Registar':'Iniciar sessão'}
            </button>
          </p>}
        </form>
        {demoMode && <div className="mt-7 p-4 bg-[#f5f8fc] rounded-xl border border-blue-100">
          <p className="text-xs font-bold text-[#205c9d]">Demonstração local</p>
          <p className="text-xs text-slate-600 mt-1.5">Email: <strong>admin@tercis.pt</strong></p>
          <p className="text-xs text-slate-600 mt-1">Palavra-passe: <strong>{DEMO_PASSWORD}</strong></p>
          <p className="text-[11px] text-slate-500 mt-2">Exemplos fictícios, sem ligação a dados comerciais.</p>
        </div>}
        <div className="mt-auto pt-8 text-[11px] text-slate-400">Tercis · Plataforma de gestão de propostas</div>
      </section>
      <aside className="hidden lg:flex flex-col bg-[#f7f9fc] border-l border-slate-100 p-9">
        <div className="flex items-center gap-2 text-[#1673e6] text-xs font-bold tracking-wide"><ShieldCheck size={17}/> Workspace organizado</div>
        <h2 className="mt-8 text-[31px] font-bold tracking-[-.045em] text-slate-900 leading-[1.14]">Mais clareza.<br/>Menos trabalho repetido.</h2>
        <p className="text-sm text-slate-500 leading-6 mt-4 max-w-sm">Estruture propostas e acompanhe o trabalho num painel simples, com informação contextual e permissões explícitas.</p>
        <div className="mt-9 space-y-3">
          {[
            {label:'Orçamentos',detail:'Da proposta ao acompanhamento',icon:FileText},
            {label:'Catálogo',detail:'Materiais e referências organizados',icon:BookOpen},
            {label:'Equipa',detail:'Responsabilidades e acesso por papel',icon:Users},
            {label:'Segurança',detail:'Autenticação e dados protegidos por políticas',icon:LockKeyhole},
          ].map(({label,detail,icon:Icon})=><div key={label} className="tercis-auth-feature bg-white border border-slate-200 rounded-xl px-4 py-3.5 flex items-center gap-3">
            <span className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0"><Icon size={18}/></span>
            <div><h3 className="text-xs font-bold text-slate-900">{label}</h3><p className="text-[11px] text-slate-500 mt-1">{detail}</p></div>
          </div>)}
        </div>
        <div className="mt-auto pt-7 border-t border-slate-200 text-xs text-slate-500">Interface compacta · Português (Portugal)</div>
      </aside>
    </div>
  </main>;
}
