import {useCallback,useEffect,useState} from 'react';
import {CreditCard,Mail,RefreshCw,ShieldCheck,GitBranch,Video} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Services={email:{state:string;ready:boolean;missing:string[]};billing:{enabled:boolean};antivirus:{configured:boolean}};
type Release={version:string;sourceSha256:string;baseCommit:string;branch:string;migrationCount:number;generatedAt:string};
export function PlatformOperationsPage(){
  const [services,setServices]=useState<Services|null>(null);
  const [release,setRelease]=useState<Release|null>(null);
  const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const {data,error:failure}=await supabase.functions.invoke('platform-readiness');
      if(failure)throw new Error('Não foi possível consultar a configuração dos serviços. Atualiza a sessão e tenta novamente.');
      setServices(data);
    }catch(cause){setServices(null);setError(cause instanceof Error?cause.message:'Serviço indisponível.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();let alive=true;void fetch(import.meta.env.BASE_URL+'release.json',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(alive&&typeof data.sourceSha256==='string')setRelease(data);}).catch(()=>{});return()=>{alive=false;};},[load]);
  const turnConfigured=(()=>{try{return JSON.parse(import.meta.env.VITE_RTC_ICE_SERVERS_JSON||'[]').some((s:{urls:string|string[]})=>(Array.isArray(s.urls)?s.urls:[s.urls]).some(url=>/^turns?:/.test(url)));}catch{return false;}})();
  return <div className="platform-operations space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Configuração da plataforma. Disponível apenas ao proprietário.</p><button className="tercis-button tercis-button-neutral" disabled={loading} onClick={()=>{void load();}}><RefreshCw size={15}/> Atualizar</button></div>
    {error&&<p role="alert" className="chat-error">{error}</p>}
    <div className="platform-service-grid">
      <article className="tercis-card"><Mail size={22}/><div><h3>Email de propostas</h3><span className="platform-service-state">{!services?'Por verificar':services.email.ready?'Configurado':services.email.state==='disabled'?'Desativado':'Configuração incompleta'}</span><p>Prepara a proposta, confirma o destinatário e acompanha a entrega. A publicação no portal é independente do email.</p>{services?.email.state!=='configured'&&<small>Falta configurar remetente, domínio e serviço de envio.</small>}</div></article>
      <article className="tercis-card"><CreditCard size={22}/><div><h3>Subscrições e pagamentos</h3><span className="platform-service-state">Desativados</span><p>A aguardar escolha do fornecedor. Nenhuma cobrança, checkout ou fatura de pagamento é criada.</p><small>Os planos e limites comerciais serão definidos antes da ativação.</small></div></article>
      <article className="tercis-card"><ShieldCheck size={22}/><div><h3>Antivírus dos anexos</h3><span className="platform-service-state">{!services?'Por verificar':services.antivirus.configured?'Ligação configurada':'Ligação por configurar'}</span><p>Os anexos permanecem em quarentena até existir um resultado de análise válido.</p><small>Uma ligação configurada exige um ensaio de análise antes de ser considerada operacional.</small></div></article>
      <article className="tercis-card"><Video size={22}/><div><h3>Chamadas em redes restritas</h3><span className="platform-service-state">{turnConfigured?'TURN configurado':'TURN por configurar'}</span><p>O servidor TURN permite estabelecer chamadas quando a rede bloqueia uma ligação direta.</p><small>O estado da chamada e a qualidade do áudio/vídeo devem ser testados em dois dispositivos.</small></div></article>
    </div>
    <section className="tercis-card platform-release"><GitBranch size={21}/><div><h3>Versão em execução</h3>{release?<><p>TERCIS {release.version} · {release.migrationCount} migrações no projeto</p><dl><div><dt>Branch</dt><dd>{release.branch}</dd></div><div><dt>Fonte SHA-256</dt><dd>{release.sourceSha256}</dd></div><div><dt>Compilação</dt><dd>{new Date(release.generatedAt).toLocaleString('pt-PT')}</dd></div></dl></>:<p>Ambiente de desenvolvimento. O manifesto é gerado na compilação da versão.</p>}</div></section>
  </div>;
}
