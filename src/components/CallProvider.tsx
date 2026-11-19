import { useCallback,useEffect,useRef,useState } from 'react';
import type { ReactNode } from 'react';
import { Mic,MicOff,Phone,PhoneOff,Video,VideoOff,X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/messaging';
import { RemoteCandidates,rtcConfiguration } from '../lib/rtc';
import { canApplyCallUpdate } from '../lib/chatSync';
import type { CallRecord,ChatContact } from '../lib/messaging';
import { ProfileImage } from './ProfileImage';
import { CallsContext } from '../auth/CallContext';
import { useIncomingCallTone } from './useIncomingCallTone';

function StreamVideo({stream,muted=false,className=''}:{stream:MediaStream|null;muted?:boolean;className?:string}) {
 const ref=useRef<HTMLVideoElement>(null);
 useEffect(()=>{if(ref.current)ref.current.srcObject=stream;},[stream]);
 return <video ref={ref} autoPlay playsInline muted={muted} className={className}/>;
}

export function CallProvider({children}:{children:ReactNode}) {
 const {profile,demoMode,session}=useAuth();
 const [call,setCall]=useState<CallRecord|null>(null);
 const [peer,setPeer]=useState<ChatContact|null>(null);
 const [phase,setPhase]=useState<'idle'|'preparing'|'ringing'|'connecting'|'connected'>('idle');
 const [local,setLocal]=useState<MediaStream|null>(null);
 const [remote,setRemote]=useState<MediaStream|null>(null);
 const [error,setError]=useState('');const [muted,setMuted]=useState(false);const [cameraOff,setCameraOff]=useState(false);
 const [seconds,setSeconds]=useState(0);
 const pcRef=useRef<RTCPeerConnection|null>(null);const mediaRef=useRef<MediaStream|null>(null);
 const callRef=useRef<CallRecord|null>(null);const generation=useRef(0);const busyRef=useRef(false);
 const applyingAnswer=useRef(false);
 const localCandidates=useRef<RTCIceCandidateInit[]>([]);
 const remoteCandidates=useRef(new RemoteCandidates());
 const available=!demoMode&&!!profile?.active&&!!navigator.mediaDevices?.getUserMedia&&typeof RTCPeerConnection!=='undefined';
 useEffect(()=>{if(!demoMode&&session?.access_token)void supabase.realtime.setAuth(session.access_token);},[session?.access_token,demoMode]);

 const clean=useCallback(()=>{
  generation.current++;busyRef.current=false;applyingAnswer.current=false;
  localCandidates.current=[];remoteCandidates.current=new RemoteCandidates();
  pcRef.current?.close();pcRef.current=null;
  mediaRef.current?.getTracks().forEach(t=>t.stop());mediaRef.current=null;
  callRef.current=null;setCall(null);setPhase('idle');setLocal(null);setRemote(null);setMuted(false);setCameraOff(false);setSeconds(0);
 },[]);
 const end=useCallback(async(status:'ended'|'declined'='ended')=>{
  const id=callRef.current?.id;clean();
  if(id){const {error:failure}=await supabase.rpc('tercis_update_call',{p_id:id,p_status:status});if(failure)setError(errorMessage(failure));}
 },[clean]);

 async function sendCandidates(token:number){
  const id=callRef.current?.id;if(!id||generation.current!==token)return;
  const candidates=localCandidates.current.splice(0);
  for(const candidate of candidates){
   if(generation.current!==token)return;
   const {error:failure}=await supabase.rpc('tercis_add_call_ice',{p_call_id:id,p_candidate:candidate});
   if(failure&&generation.current===token){setError(errorMessage(failure));await end();return;}
  }
 }
 async function receiveCandidate(row:{call_id:string;sender_id:string;candidate:RTCIceCandidateInit}){
  if(row.call_id!==callRef.current?.id||row.sender_id===profile?.id)return;
  remoteCandidates.current.push(row.candidate);
  const pc=pcRef.current;const token=generation.current;
  if(pc)try{await remoteCandidates.current.flush(pc);}catch(cause){if(generation.current===token){setError(errorMessage(cause));await end();}}
 }
 async function loadCandidates(id:string){
  const {data,error:failure}=await supabase.from('tercis_call_ice').select('call_id,sender_id,candidate').eq('call_id',id).order('created_at');
  if(failure)throw failure;
  for(const row of data||[])await receiveCandidate(row);
 }

 async function prepare(kind:'audio'|'video',token:number) {
  const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'?{width:{ideal:1280},height:{ideal:720}}:false});
  if(generation.current!==token){stream.getTracks().forEach(t=>t.stop());throw new Error('A chamada foi cancelada.');}
  mediaRef.current=stream;setLocal(stream);
  const pc=new RTCPeerConnection(rtcConfiguration(import.meta.env.VITE_RTC_ICE_SERVERS_JSON));pcRef.current=pc;
  pc.onicecandidate=event=>{if(event.candidate&&generation.current===token){localCandidates.current.push(event.candidate.toJSON());void sendCandidates(token);}};
  stream.getTracks().forEach(track=>pc.addTrack(track,stream));
  pc.ontrack=event=>{if(generation.current===token)setRemote(event.streams[0]||new MediaStream([event.track]));};
  pc.onconnectionstatechange=()=>{
   if(generation.current!==token)return;
   if(pc.connectionState==='connected')setPhase('connected');
   if(pc.connectionState==='failed'){setError('Não foi possível ligar a chamada. Esta rede pode precisar de um servidor TURN.');void end();}
   if(pc.connectionState==='disconnected')setPhase('connecting');
  };
  return pc;
 }

 async function start(contact:ChatContact,kind:'audio'|'video') {
  if(busyRef.current||!available)return;
  busyRef.current=true;const token=++generation.current;setPeer(contact);setError('');setPhase('preparing');
  let createdId:string|null=null;
  try {
   const pc=await prepare(kind,token);await pc.setLocalDescription(await pc.createOffer());
   const offer=pc.localDescription!.toJSON();
   if(generation.current!==token)return;
   const {data,error:failure}=await supabase.rpc('tercis_start_call',{p_peer:contact.id,p_kind:kind,p_offer:offer});
   if(failure)throw failure;createdId=data as string;
   if(generation.current!==token){await supabase.rpc('tercis_update_call',{p_id:createdId,p_status:'ended'});return;}
   const {data:row,error:readError}=await supabase.from('tercis_calls').select('*').eq('id',createdId).single();
   if(readError)throw readError;
   if(generation.current!==token){await supabase.rpc('tercis_update_call',{p_id:createdId,p_status:'ended'});return;}
   callRef.current=row as CallRecord;setCall(row as CallRecord);setPhase('ringing');
   await sendCandidates(token);await loadCandidates(createdId);
   // Re-read after assigning the ref to cover acceptance during the initial read.
   const {data:latest}=await supabase.from('tercis_calls').select('*').eq('id',createdId).single();
   if(latest&&generation.current===token)await handleUpdate(latest as CallRecord);
  }catch(cause){
   if(createdId)await supabase.rpc('tercis_update_call',{p_id:createdId,p_status:'ended'});
   if(generation.current===token){clean();setError(errorMessage(cause,'Não foi possível aceder ao microfone ou à câmara.'));}
  }
 }

 async function accept() {
  const incoming=callRef.current;if(!incoming||phase!=='ringing')return;
  const token=++generation.current;setPhase('preparing');setError('');
  try {
   const pc=await prepare(incoming.kind,token);await pc.setRemoteDescription(incoming.offer);
   await loadCandidates(incoming.id);await remoteCandidates.current.flush(pc);
   await pc.setLocalDescription(await pc.createAnswer());const answer=pc.localDescription!.toJSON();
   if(generation.current!==token)return;
   const {error:failure}=await supabase.rpc('tercis_update_call',{p_id:incoming.id,p_status:'accepted',p_answer:answer});
   if(failure)throw failure;
   if(generation.current!==token)return;
   const accepted={...incoming,status:'accepted' as const,answer};callRef.current=accepted;setCall(accepted);
   await sendCandidates(token);
   setPhase(pc.connectionState==='connected'?'connected':'connecting');
  }catch(cause){if(generation.current===token){setError(errorMessage(cause));await end();}}
 }

 async function handleUpdate(row:CallRecord) {
  if(!canApplyCallUpdate(callRef.current,row))return;
  if(row.status==='ended'||row.status==='declined'){
   clean();setError(row.status==='declined'?'A chamada foi recusada.':'Chamada terminada.');return;
  }
  callRef.current=row;setCall(row);
  const pc=pcRef.current;
  if(row.status==='accepted'&&row.caller_id===profile?.id&&row.answer&&pc?.signalingState==='have-local-offer'&&!applyingAnswer.current){
   applyingAnswer.current=true;const token=generation.current;
   try {await pc.setRemoteDescription(row.answer);await loadCandidates(row.id);await remoteCandidates.current.flush(pc);if(generation.current===token)setPhase(pc.connectionState==='connected'?'connected':'connecting');}
   catch(cause){if(generation.current===token){setError(errorMessage(cause));await end();}}
   finally{if(generation.current===token)applyingAnswer.current=false;}
  }
 }
 const updateHandler=useRef(handleUpdate);updateHandler.current=handleUpdate;
 const candidateHandler=useRef(receiveCandidate);candidateHandler.current=receiveCandidate;

 useEffect(()=>{
  if(demoMode||!profile?.active)return;
  let alive=true;let synchronizing=false;
  async function receive(row:CallRecord){
   if(!alive)return;
   if(callRef.current?.id===row.id){await updateHandler.current(row);return;}
   if(row.callee_id!==profile?.id||row.status!=='ringing'||Date.now()-Date.parse(row.created_at)>60000||busyRef.current)return;
   busyRef.current=true;callRef.current=row;setCall(row);setPhase('ringing');setError('');
   const {data}=await supabase.rpc('tercis_chat_contacts');
   if(alive&&callRef.current?.id===row.id)setPeer((data as ChatContact[]|null)?.find(p=>p.id===row.caller_id)||null);
  }
  // Recover incoming calls, answers, hangups and ICE even when a websocket event is missed.
  async function synchronize(){
   if(!alive||synchronizing)return;synchronizing=true;
   const current=callRef.current;
   try{
    const query=supabase.from('tercis_calls').select('*');
    const {data,error:failure}=current
     ?await query.eq('id',current.id).limit(1)
     :await query.eq('callee_id',profile!.id).eq('status','ringing').gt('created_at',new Date(Date.now()-60000).toISOString()).order('created_at',{ascending:false}).limit(1);
    if(!alive||failure)return;
    if(data?.[0])await receive(data[0] as CallRecord);
    else if(current&&callRef.current?.id===current.id){clean();setError('A chamada deixou de estar disponível.');}
    if(alive&&current&&callRef.current?.id===current.id)await loadCandidates(current.id);
   }catch{/* A transient network failure is retried without closing the call. */}
   finally{synchronizing=false;}
  }
  const channel=supabase.channel(`tercis-calls:${profile.id}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'tercis_calls'},payload=>{void receive(payload.new as CallRecord);})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'tercis_call_ice'},payload=>{void candidateHandler.current(payload.new as {call_id:string;sender_id:string;candidate:RTCIceCandidateInit});})
   .subscribe(status=>{
    if(alive&&status==='SUBSCRIBED')void synchronize();
   });
  void synchronize();
  const poll=window.setInterval(()=>{void synchronize();},2000);
  const onWake=()=>{void synchronize();};
  window.addEventListener('focus',onWake);window.addEventListener('online',onWake);document.addEventListener('visibilitychange',onWake);
  const handleExit=()=>{const id=callRef.current?.id;if(id)void supabase.rpc('tercis_update_call',{p_id:id,p_status:'ended'});clean();};
  window.addEventListener('pagehide',handleExit);
  return()=>{alive=false;window.clearInterval(poll);window.removeEventListener('focus',onWake);window.removeEventListener('online',onWake);document.removeEventListener('visibilitychange',onWake);window.removeEventListener('pagehide',handleExit);void supabase.removeChannel(channel);handleExit();};
  // Event and polling callbacks use refs to the latest per-call handlers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[profile?.id,profile?.active,demoMode,clean]);

 const callId=call?.id;const callStatus=call?.status;const callCreatedAt=call?.created_at;
 useEffect(()=>{
  if(!callId)return;
  if(callStatus==='ringing'&&callCreatedAt){
   const timer=window.setTimeout(()=>{setError('A chamada não foi atendida.');void end();},Math.max(0,60000-(Date.now()-Date.parse(callCreatedAt))));
   return()=>window.clearTimeout(timer);
  }
  if(callStatus!=='accepted')return;
  const timer=window.setInterval(()=>{
   void supabase.rpc('tercis_call_heartbeat',{p_id:callId}).then(({data,error:failure})=>{
    if(callRef.current?.id!==callId)return;
    if(failure||!data){setError('A chamada perdeu a ligação ou a autorização.');void end();}
   });
  },20000);
  return()=>window.clearInterval(timer);
 },[callId,callStatus,callCreatedAt,end]);
 useEffect(()=>{if(phase!=='connected')return;const timer=window.setInterval(()=>setSeconds(n=>n+1),1000);return()=>window.clearInterval(timer);},[phase]);
 useEffect(()=>{
  if(phase!=='connecting')return;
  const timer=window.setTimeout(()=>{setError('A ligação de áudio/vídeo demorou demasiado. Tenta novamente ou verifica a configuração TURN.');void end();},30000);
  return()=>window.clearTimeout(timer);
 },[phase,end]);
 const modalOpen=phase!=='idle';
 useEffect(()=>{
  if(!modalOpen)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const background=document.querySelector('.tercis-app');background?.setAttribute('inert','');
  const timer=window.setTimeout(()=>document.querySelector<HTMLButtonElement>('.call-controls button')?.focus(),0);
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();void end(callRef.current?.callee_id===profile?.id&&callRef.current?.status==='ringing'?'declined':'ended');}
   if(event.key==='Tab'){
    const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('.call-panel button:not(:disabled)'));
    const first=buttons[0];const last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',keyboard);
  return()=>{window.clearTimeout(timer);document.removeEventListener('keydown',keyboard);background?.removeAttribute('inert');previous?.focus();};
 },[modalOpen,end,profile?.id]);

 const incoming=Boolean(phase==='ringing'&&call&&call.callee_id===profile?.id&&call.status==='ringing');
 useIncomingCallTone(incoming);
 return <CallsContext.Provider value={{start,busy:phase!=='idle',available}}>
  {children}
  {error&&<div className="call-notice" role="status"><span>{error}</span><button onClick={()=>setError('')} aria-label="Fechar aviso"><X size={18}/></button></div>}
  {phase!=='idle'&&<section className="call-overlay" role="dialog" aria-modal="true" aria-label="Chamada Tercis">
   <div className="call-panel">
    <header><span className="call-brand">TERCIS / {call?.kind==='video'?'VIDEOCHAMADA':'CHAMADA'}</span><span>{phase==='connected'?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'Ligação privada'}</span></header>
    <div className="call-stage">
     <StreamVideo stream={remote} className={call?.kind==='video'&&remote?'call-remote':'sr-only'}/>
     {(!remote||call?.kind!=='video')&&<div className="call-person"><ProfileImage path={peer?.avatar_url} name={peer?.full_name||'Contacto'}/><h2>{peer?.full_name||'Chamada recebida'}</h2><p>{peer?.organization_name}</p></div>}
     {local&&local.getVideoTracks().length>0&&<StreamVideo stream={local} muted className="call-self"/>}
    </div>
    <p className="call-status" role="status">{incoming?'Está a ligar para ti':phase==='preparing'?'A preparar microfone e câmara…':phase==='ringing'?'A chamar…':phase==='connecting'?'A estabelecer a ligação…':'Chamada em curso'}</p>
    <div className="call-controls">
     {incoming&&<button type="button" className="call-accept" onClick={()=>{void accept();}}><Phone size={21}/> Atender</button>}
     {!incoming&&local&&<><button type="button" aria-label={muted?'Ativar microfone':'Silenciar microfone'} aria-pressed={muted} onClick={()=>{mediaRef.current?.getAudioTracks().forEach(t=>{t.enabled=muted;});setMuted(!muted);}}>{muted?<MicOff/>:<Mic/>}</button>
      {local.getVideoTracks().length>0&&<button type="button" aria-label={cameraOff?'Ativar câmara':'Desativar câmara'} aria-pressed={cameraOff} onClick={()=>{mediaRef.current?.getVideoTracks().forEach(t=>{t.enabled=cameraOff;});setCameraOff(!cameraOff);}}>{cameraOff?<VideoOff/>:<Video/>}</button>}</>}
     <button type="button" className="call-end" onClick={()=>{void end(incoming?'declined':'ended');}}><PhoneOff size={21}/>{incoming?'Recusar':'Terminar'}</button>
    </div>
   </div>
  </section>}
 </CallsContext.Provider>;
}
