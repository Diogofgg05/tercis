import { useEffect, useState } from 'react';
import { Check, LockKeyhole, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { MFASettings } from '../components/MFASettings';

type Tab = 'profile'|'security'|'preferences'|'about';
type Form = { full_name:string; phone:string; job_title:string; department:string; address:string; postal_code:string; locality:string; website:string };
const empty:Form={full_name:'',phone:'',job_title:'',department:'',address:'',postal_code:'',locality:'',website:''};

export function SettingsView({onOpenAccess}:{onOpenAccess?:()=>void}) {
  const {profile,demoMode,refreshProfile} = useAuth();
  const [tab,setTab] = useState<Tab>('profile');
  const [form,setForm] = useState<Form>(empty);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const [password,setPassword] = useState('');
  const [passwordConfirm,setPasswordConfirm] = useState('');
  const [compact,setCompact] = useState(()=>localStorage.getItem('tercis:compact-ui') !== 'false');

  useEffect(()=>{
    if(!profile)return;
    setForm({
      full_name:profile.full_name||'',phone:profile.phone||'',job_title:profile.job_title||'',
      department:profile.department||'',address:profile.address||'',
      postal_code:profile.postal_code||'',locality:profile.locality||'',website:profile.website||'',
    });
  },[profile]);

  useEffect(()=>{
    localStorage.setItem('tercis:compact-ui',String(compact));
    document.documentElement.classList.toggle('tercis-compact',compact);
  },[compact]);

  async function saveProfile() {
    if(demoMode || !profile)return;
    if(!form.full_name.trim()){setError('O nome do perfil é obrigatório.');return;}
    setSaving(true);setError('');setSuccess('');
    try {
      const {error:failure}=await supabase.from('profiles').update(form).eq('id',profile.id).select('id').single();
      if(failure)throw failure;
      setSuccess('Perfil atualizado com sucesso.');
      try {
        await refreshProfile();
      } catch {
        setSuccess('Perfil guardado. A atualização da sessão falhou; consulte novamente esta página.');
      }
    } catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível guardar o perfil.');}
    finally{setSaving(false);}
  }

  async function changePassword() {
    if(demoMode)return;
    if(password.length<12){setError('Escolha uma palavra-passe com pelo menos 12 caracteres.');return;}
    if(password!==passwordConfirm){setError('As palavras-passe não coincidem.');return;}
    setSaving(true);setError('');setSuccess('');
    try {
      const {error:failure}=await supabase.auth.updateUser({password});
      if(failure)throw failure;
      setPassword('');setPasswordConfirm('');
      setSuccess('Palavra-passe alterada. A gestão das outras sessões depende das políticas de autenticação do Supabase.');
    } catch(cause){setError(cause instanceof Error?cause.message:'Falha na alteração da palavra-passe.');}
    finally{setSaving(false);}
  }

  async function revokeOtherSessions(){
    if(demoMode||saving)return;
    if(!window.confirm('Terminar as outras sessões autenticadas da sua conta? Os tokens de acesso existentes podem permanecer válidos até expirarem.'))return;
    setSaving(true);setError('');setSuccess('');
    try {
      const {error:failure}=await supabase.auth.signOut({scope:'others'});
      if(failure)throw failure;
      setSuccess('As outras sessões foram revogadas no Supabase Auth. Alguns acessos existentes podem manter-se até expirar o token JWT.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível revogar outras sessões.');
    }finally{setSaving(false);}
  }

    const tabs: {id:Tab;label:string;icon:typeof UserRound}[]=[
    {id:'profile',label:'O meu perfil',icon:UserRound},{id:'security',label:'Segurança',icon:LockKeyhole},
    {id:'preferences',label:'Preferências',icon:Settings},{id:'about',label:'Sobre e acessos',icon:ShieldCheck},
  ];

  return <div className="tercis-page space-y-5">
    <header className="tercis-head"><div>
      <p className="tercis-eyebrow">Tercis / Conta</p><h1 className="tercis-title">Definições</h1>
      <p className="tercis-subtitle">Perfil, segurança e apresentação num único lugar.</p>
    </div></header>
    {demoMode && <div className="tercis-note">Modo demonstração: alterações ao perfil, senha e autenticação de dois fatores estão desativadas. As preferências visuais são guardadas apenas neste navegador.</div>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3">{success}</p>}
    <div className="grid lg:grid-cols-[190px_minmax(0,1fr)] gap-4">
      <nav className="tercis-card p-2 flex lg:flex-col gap-1 lg:self-start overflow-x-auto" aria-label="Secções das definições">
        {tabs.map(({id,label,icon:Icon})=><button key={id} type="button"
          onClick={()=>{setTab(id);setError('');setSuccess('')}}
          aria-current={tab===id?'page':undefined}
          className={'flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-xs font-semibold whitespace-nowrap '+
            (tab===id?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50')}>
          <Icon size={16}/>{label}
        </button>)}
      </nav>
      <section className="tercis-card min-w-0">
        {tab==='profile' && <>
          <div className="tercis-card-header"><h2 className="tercis-card-title">Dados do perfil</h2>
            <p className="text-[11px] text-slate-500 mt-1">Informação de contacto para trabalho e comunicação interna.</p></div>
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold">Email de acesso
                <input disabled value={profile?.email||''} className="tercis-input mt-1.5 bg-slate-50 text-slate-500"/>
              </label>
              {([
                ['full_name','Nome completo'],['phone','Contacto telefónico'],['job_title','Função'],
                ['department','Departamento'],['address','Morada'],['postal_code','Código postal'],
                ['locality','Localidade'],['website','Website'],
              ] as const).map(([key,label])=><label key={key} className={'text-xs font-semibold '+(key==='address'?'sm:col-span-2':'')}>
                {label}<input value={form[key]} disabled={demoMode} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                  className="tercis-input mt-1.5" placeholder={label}/>
              </label>)}
            </div>
            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button disabled={saving||demoMode} onClick={()=>{void saveProfile()}} className="tercis-button tercis-button-primary">
                {saving?'A guardar…':<><Check size={15}/> Guardar perfil</>}
              </button>
            </div>
          </div>
        </>}
        {tab==='security' && <div className="p-4 sm:p-5 space-y-5">
          <MFASettings demoMode={demoMode}/>
          <div className="border-t border-slate-200 pt-5">
            <h3 className="tercis-card-title">Palavra-passe</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">A alteração é confirmada pelo Supabase Auth.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold">Nova palavra-passe
                <input type="password" autoComplete="new-password" value={password}
                  onChange={e=>setPassword(e.target.value)} disabled={demoMode} className="tercis-input mt-1.5"/>
              </label>
              <label className="text-xs font-semibold">Confirmar palavra-passe
                <input type="password" autoComplete="new-password" value={passwordConfirm}
                  onChange={e=>setPasswordConfirm(e.target.value)} disabled={demoMode} className="tercis-input mt-1.5"/>
              </label>
            </div>
            <button disabled={saving||demoMode||!password} onClick={()=>{void changePassword()}}
              className="tercis-button tercis-button-primary mt-4">Alterar palavra-passe</button>
          </div>
          <div className="border-t border-slate-200 pt-5 space-y-2">
            <h3 className="tercis-card-title">Sessões e dispositivos</h3>
            <p className="text-xs text-slate-500">Revogue os tokens de atualização dos outros dispositivos. Os JWT já emitidos podem continuar válidos até expirarem.</p>
            <button type="button" disabled={saving||demoMode}
              onClick={()=>{void revokeOtherSessions();}}
              className="tercis-button tercis-button-neutral disabled:opacity-50">
              Terminar outras sessões
            </button>
          </div>
        </div>}
        {tab==='preferences' && <div className="p-4 sm:p-5 space-y-5">
          <div><h2 className="tercis-card-title">Apresentação</h2><p className="text-xs text-slate-500 mt-1">Preferências locais deste dispositivo.</p></div>
          <label className="flex items-center justify-between gap-4 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer">
            <span><strong className="text-xs block">Densidade compacta</strong><span className="text-[11px] text-slate-500">Menos espaçamento em tabelas e cartões.</span></span>
            <input type="checkbox" className="accent-blue-600 h-4 w-4" checked={compact} onChange={e=>setCompact(e.target.checked)}/>
          </label>
          <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">Idioma: Português (Portugal) · Moeda: EUR. A alteração de idioma e moeda ainda não está disponível.</div>
        </div>}
        {tab==='about' && <div className="p-4 sm:p-5 space-y-4">
          <div><h2 className="tercis-card-title">Tercis</h2>
            <p className="text-xs text-slate-500 mt-2 leading-5">Sistema de gestão de orçamentos, clientes e catálogo. As funcionalidades comerciais dependem das permissões e serviços da conta real.</p></div>
          <div className="border border-slate-100 rounded-xl p-4">
            <h3 className="font-semibold text-xs">O meu papel</h3>
            <p className="text-sm mt-1">{profile?.role||'Indisponível'}</p>
            <p className="text-[11px] text-slate-500 mt-2">Consulta a matriz para perceber quais as ações disponíveis e os estados de orçamento permitidos.</p>
            {onOpenAccess && <button type="button" onClick={onOpenAccess} className="tercis-button tercis-button-neutral mt-3">Ver perfis e permissões</button>}
          </div>
          <div className="tercis-note">Não são apresentadas certificações, garantias de backup, suporte ou conformidade legal que ainda não tenham sido comprovadas.</div>
        </div>}
      </section>
    </div>
  </div>;
}
