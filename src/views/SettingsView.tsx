import { useEffect, useState } from 'react';
import { LockKeyhole, Settings, ShieldCheck, UserRound, UploadCloud, Loader2, Video, Mail, CheckCircle2, Save } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { MFASettings } from '../components/MFASettings';
import { FormSection, FormGrid, FormField } from '../components/FormLayout';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog';
import type { UserRole } from '../types';
import { ProfileImage } from '../components/ProfileImage';
import { errorMessage, normalizeProfileImage } from '../lib/messaging';
import { DeviceCheck } from '../components/DeviceCheck';

const roleTitles:Record<UserRole,string> = {
  app_admin:'Administrador da plataforma',
  company_admin:'Administrador da empresa',
  admin:'Administrador legado',
  collaborator:'Colaborador',
  client:'Cliente',
};

type Tab = 'profile'|'security'|'communication'|'preferences'|'about';
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
  const [confirmRevoke,setConfirmRevoke] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [compact,setCompact] = useState(()=>localStorage.getItem('tercis:compact-ui') !== 'false');

  useEffect(()=>{
    if(!profile)return;
    setForm({
      full_name:profile.full_name||'',phone:profile.phone||'',job_title:profile.job_title||'',
      department:profile.department||'',address:profile.address||'',
      postal_code:profile.postal_code||'',locality:profile.locality||'',website:profile.website||'',
    });
  // Refreshing only the avatar must not erase unsaved contact details.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[profile?.id,profile?.full_name,profile?.phone,profile?.job_title,profile?.department,profile?.address,profile?.postal_code,profile?.locality,profile?.website]);

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

  async function uploadPhoto(file:File) {
    if(!profile||demoMode||uploading)return;
    setUploading(true);setError('');setSuccess('');
    let path:string|null=null;let saved=false;
    try {
      const blob=await normalizeProfileImage(file);
      path=`${profile.id}/${crypto.randomUUID()}.webp`;
      const {error:failure}=await supabase.storage.from('tercis-profile-media').upload(path,blob,{contentType:'image/webp',upsert:false});
      if(failure)throw failure;
      const {error:updateError}=await supabase.from('profiles').update({avatar_url:path}).eq('id',profile.id).select('id').single();
      if(updateError)throw updateError;saved=true;
      await refreshProfile();setSuccess('Fotografia atualizada.');
    }catch(cause){setError(saved?'Fotografia guardada. Atualiza a página para a visualizar.':errorMessage(cause));
      if(path&&!saved)await supabase.storage.from('tercis-profile-media').remove([path]);
    }finally{setUploading(false);}
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

    setSaving(true);setError('');setSuccess('');
    try {
      const {error:failure}=await supabase.auth.signOut({scope:'others'});
      if(failure)throw failure;
      setConfirmRevoke(false);
      setSuccess('As outras sessões foram revogadas no Supabase Auth. Alguns acessos existentes podem manter-se até expirar o token JWT.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível revogar outras sessões.');
    }finally{setSaving(false);}
  }

  const tabs: {id:Tab;label:string;description:string;icon:typeof UserRound}[]=[
    {id:'profile',label:'O meu perfil',description:'Identidade e contactos',icon:UserRound},
    {id:'security',label:'Segurança',description:'Palavra-passe e proteção',icon:LockKeyhole},
    {id:'communication',label:'Chamadas',description:'Câmara e microfone',icon:Video},
    {id:'preferences',label:'Preferências',description:'O espaço à tua medida',icon:Settings},
    {id:'about',label:'Conta e permissões',description:'O teu papel na empresa',icon:ShieldCheck},
  ];

  return <div className="tercis-page settings-page space-y-5">
    <header className="tercis-head"><div>
      <p className="tercis-eyebrow">Tercis / Conta</p><h1 className="tercis-title">Definições</h1>
      <p className="tercis-subtitle">Um espaço de trabalho com a tua identidade.</p>
    </div><span className="settings-private-label"><ShieldCheck size={16}/> A tua conta, sob controlo</span></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3">{success}</p>}
    <div className="settings-account-card"><div className="settings-account-identity"><ProfileImage path={profile?.avatar_url} name={profile?.full_name||'Perfil'}/><div><span className="tercis-eyebrow">O TEU ESPAÇO NA TERCIS</span><h2>{profile?.full_name||'O meu perfil'}</h2><p><Mail size={14}/>{profile?.email}</p></div></div><div className="settings-account-status"><span className="settings-role"><ShieldCheck size={16}/>{profile?.platform_admin?'Administrador da plataforma':profile?.role?roleTitles[profile.role]:'Conta'}</span><span><CheckCircle2 size={14}/> {profile?.active?'Conta ativa':'Conta pendente'}</span></div></div>
    <div className="settings-layout">
      <nav className="settings-navigation" aria-label="Secções das definições">
        {tabs.map(({id,label,description,icon:Icon})=><button key={id} type="button"
          onClick={()=>{setTab(id);setError('');setSuccess('')}}
            aria-label={label} aria-describedby={'settings-nav-description-'+id}
          aria-current={tab===id?'page':undefined}
          className={tab===id?'settings-nav-item is-active':'settings-nav-item'}>
            <span className="settings-nav-icon"><Icon size={19}/></span><span><strong>{label}</strong><small id={'settings-nav-description-'+id}>{description}</small></span>
        </button>)}
      </nav>
      <section className="tercis-card settings-content min-w-0">
        {tab==='profile' && <>
          <div className="tercis-card-header settings-section-heading"><span className="settings-section-icon"><UserRound size={23}/></span><div><h2 className="tercis-card-title">Apresenta-te à tua equipa.</h2>
            <p className="text-[11px] text-slate-500 mt-1">Mantém a tua informação atualizada para trabalhar mais perto dos teus colegas.</p></div></div>
          <div className="settings-profile-form">
            <div className="settings-photo"><ProfileImage path={profile?.avatar_url} name={profile?.full_name||'Perfil'}/><div><h3>Fotografia de perfil</h3><p>Ajuda os teus colegas e parceiros a reconhecer-te.</p><label className={`tercis-button tercis-button-neutral inline-flex mt-3 ${uploading?'opacity-50':''}`}>
              {uploading?<Loader2 size={17} className="animate-spin"/>:<UploadCloud size={17}/>} {uploading?'A enviar…':'Carregar fotografia'}
              <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" disabled={demoMode||uploading} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void uploadPhoto(file);}}/>
            </label><small>JPG, PNG ou WebP · até 5 MB</small></div></div>
            <FormSection className="settings-form-row" title="Conta" description="O nome apresentado aos colegas e o email de acesso.">
              <FormGrid>
                <FormField label="Nome completo" required>
                  <input data-autofocus value={form.full_name} disabled={demoMode} autoComplete="name"
                    onChange={e=>setForm(p=>({...p,full_name:e.target.value}))} className="tercis-input"/>
                </FormField>
                <FormField label="Email de acesso" hint="O email não pode ser alterado neste formulário.">
                  <input disabled value={profile?.email||''} className="tercis-input"/>
                </FormField>
              </FormGrid>
            </FormSection>
            <FormSection className="settings-form-row" title="Informação profissional" description="Função e departamento na organização.">
              <FormGrid>
                {([['job_title','Função'],['department','Departamento']] as const).map(([key,label])=>
                  <FormField key={key} label={label}>
                    <input value={form[key]} disabled={demoMode}
                      onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                      className="tercis-input" placeholder={label}/>
                  </FormField>)}
              </FormGrid>
            </FormSection>
            <FormSection className="settings-form-row" title="Contactos e morada" description="Informação opcional para a tua equipa.">
              <FormGrid className="settings-contact-grid">
                <FormField label="Contacto telefónico" className="settings-field-phone">
                  <input type="tel" value={form.phone} disabled={demoMode}
                    onChange={e=>setForm(p=>({...p,phone:e.target.value}))}
                    className="tercis-input" autoComplete="tel"/>
                </FormField>
                <FormField label="Website" className="settings-field-website">
                  <input type="url" value={form.website} disabled={demoMode}
                    onChange={e=>setForm(p=>({...p,website:e.target.value}))}
                    className="tercis-input" placeholder="https://"/>
                </FormField>
                <FormField label="Morada" wide className="settings-field-address">
                  <input value={form.address} disabled={demoMode}
                    onChange={e=>setForm(p=>({...p,address:e.target.value}))}
                    className="tercis-input" autoComplete="street-address"/>
                </FormField>
                <FormField label="Código postal" className="settings-field-postal">
                  <input value={form.postal_code} disabled={demoMode}
                    onChange={e=>setForm(p=>({...p,postal_code:e.target.value}))}
                    className="tercis-input" autoComplete="postal-code"/>
                </FormField>
                <FormField label="Localidade" className="settings-field-locality">
                  <input value={form.locality} disabled={demoMode}
                    onChange={e=>setForm(p=>({...p,locality:e.target.value}))}
                    className="tercis-input" autoComplete="address-level2"/>
                </FormField>
              </FormGrid>
            </FormSection>
            <div className="settings-save-bar"><span>As alterações ficam associadas à tua conta.</span>
              <button disabled={saving||demoMode} onClick={()=>{void saveProfile()}} className="tercis-button tercis-button-primary">
                {saving?'A guardar…':<><Save size={16}/> Guardar alterações</>}
              </button>
            </div>
          </div>
        </>}
        {tab==='communication'&&<div className="p-5 sm:p-7"><DeviceCheck/></div>}
        {tab==='security' && <div className="p-4 sm:p-5">
          <FormSection title="Autenticação em dois fatores" description="Proteja o acesso à conta com um autenticador.">
            <MFASettings demoMode={demoMode}/>
          </FormSection>
          <FormSection title="Palavra-passe" description="Escolhe uma palavra-passe exclusiva para proteger a tua conta.">
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
          </FormSection>
          <FormSection title="Sessões e dispositivos"
            description="Termina o acesso nos outros dispositivos. Algumas sessões podem demorar a expirar.">
            <button type="button" disabled={saving||demoMode}
              onClick={()=>setConfirmRevoke(true)}
              className="tercis-button tercis-button-neutral disabled:opacity-50">
              Terminar outras sessões
            </button>
          </FormSection>
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
            <p className="text-[14px] font-semibold text-blue-800 mt-1">
              {profile?.platform_admin?'Administrador da plataforma':profile?.role?roleTitles[profile.role]:'Indisponível'}
            </p>
            <p className="text-[11px] text-slate-500 mt-2">Consulta a matriz para perceber quais as ações disponíveis e os estados de orçamento permitidos.</p>
            {onOpenAccess && <button type="button" onClick={onOpenAccess} className="tercis-button tercis-button-neutral mt-3">Ver perfis e permissões</button>}
          </div>
          <div className="tercis-note">Precisas de alterar as tuas permissões? Contacta o administrador da tua empresa.</div>
        </div>}
      </section>
    </div>
    <ConfirmActionDialog open={confirmRevoke} busy={saving} danger
      title="Terminar outras sessões"
      description="Esta ação revoga as outras sessões autenticadas da sua conta."
      confirmLabel="Terminar outras sessões"
      onClose={()=>setConfirmRevoke(false)}
      onConfirm={()=>{void revokeOtherSessions();}}>
      <p>Os tokens JWT já emitidos podem continuar válidos até à expiração. A sessão atual não será terminada.</p>
      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 p-3">{error}</p>}
    </ConfirmActionDialog>
  </div>;
}
