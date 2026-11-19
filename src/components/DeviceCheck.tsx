import { useEffect,useRef,useState } from 'react';
import { CheckCircle2,Mic,MonitorPlay,Square,Video } from 'lucide-react';
import { errorMessage } from '../lib/messaging';
import { useCalls } from '../auth/CallContext';

export function DeviceCheck(){
 const {busy}=useCalls();
 const [running,setRunning]=useState(false);const [starting,setStarting]=useState(false);
 const [video,setVideo]=useState(true);const [level,setLevel]=useState(0);const [error,setError]=useState('');
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]);const [microphone,setMicrophone]=useState('');const [camera,setCamera]=useState('');
 const element=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);
 const context=useRef<AudioContext|null>(null);const frame=useRef(0);const generation=useRef(0);
 function stop(){
  generation.current++;cancelAnimationFrame(frame.current);stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  if(context.current)void context.current.close();context.current=null;
  if(element.current)element.current.srcObject=null;setRunning(false);setStarting(false);setLevel(0);
 }
 useEffect(()=>{
  const media=stream;const audio=context;const renderFrame=frame;const token=generation;
  return()=>{token.current++;cancelAnimationFrame(renderFrame.current);media.current?.getTracks().forEach(track=>track.stop());if(audio.current)void audio.current.close();};
 },[]);
 useEffect(()=>{if(busy)stop();},[busy]);
 async function start(){
  if(busy||starting)return;
  stop();const token=++generation.current;setStarting(true);setError('');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Abre a plataforma por HTTPS ou localhost para usar o microfone e a câmara.');
   const media=await navigator.mediaDevices.getUserMedia({audio:microphone?{deviceId:{exact:microphone}}:true,video:video?(camera?{deviceId:{exact:camera}}:true):false});
   if(generation.current!==token){media.getTracks().forEach(track=>track.stop());return;}
   stream.current=media;if(element.current)element.current.srcObject=media;
   const audio=new AudioContext();context.current=audio;await audio.resume();
   if(generation.current!==token)return;
   const analyser=audio.createAnalyser();analyser.fftSize=256;audio.createMediaStreamSource(media).connect(analyser);
   const samples=new Uint8Array(analyser.frequencyBinCount);
   const measure=()=>{
    if(generation.current!==token)return;analyser.getByteTimeDomainData(samples);
    const rms=Math.sqrt(samples.reduce((sum,value)=>sum+((value-128)/128)**2,0)/samples.length);
    setLevel(Math.min(100,Math.round(rms*350)));frame.current=requestAnimationFrame(measure);
   };
   measure();setRunning(true);setStarting(false);
   const discovered=await navigator.mediaDevices.enumerateDevices();if(generation.current===token)setDevices(discovered);
  }catch(cause){if(generation.current===token){stop();setError(errorMessage(cause,'Não foi possível aceder aos dispositivos. Verifica as permissões do navegador.'));}}
 }
 return <section className="device-check">
  <div className="device-check-copy"><span className="settings-section-icon"><MonitorPlay size={23}/></span><h2>Pronto para conversar?</h2><p>Confirma a imagem e o som antes da próxima chamada. Este teste fica apenas no teu dispositivo.</p></div>
  <div className="device-preview"><video ref={element} autoPlay playsInline muted className={running&&video?'':'invisible'}/>{(!running||!video)&&<div><Video size={34}/><span>{running?'Teste de áudio em curso':'A tua câmara aparece aqui'}</span></div>}{running&&video&&<span className="device-live-label"><CheckCircle2 size={14}/> Câmara ativa</span>}</div>
  <div className="device-controls"><label><span>Microfone</span><select value={microphone} disabled={running||starting} onChange={e=>setMicrophone(e.target.value)} className="tercis-input"><option value="">Dispositivo predefinido</option>{devices.filter(d=>d.kind==='audioinput').map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Microfone ${index+1}`}</option>)}</select></label>
   <label><span>Câmara</span><select value={camera} disabled={running||starting||!video} onChange={e=>setCamera(e.target.value)} className="tercis-input"><option value="">Câmara predefinida</option>{devices.filter(d=>d.kind==='videoinput').map((device,index)=><option key={device.deviceId} value={device.deviceId}>{device.label||`Câmara ${index+1}`}</option>)}</select></label></div>
  <div className="device-microphone"><Mic size={18}/><span>Fala para testar o microfone</span><div role="meter" aria-label="Nível do microfone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level}><i style={{width:`${level}%`}}/></div></div>
  <div className="device-actions"><label><input type="checkbox" checked={video} disabled={running||starting} onChange={e=>setVideo(e.target.checked)}/> Incluir vídeo no teste</label><button type="button" className={`tercis-button ${running?'tercis-button-neutral':'tercis-button-primary'}`} disabled={busy||starting} onClick={()=>{if(running)stop();else void start();}}>{running?<Square size={16}/>:<MonitorPlay size={18}/>} {starting?'A pedir acesso…':running?'Terminar teste':'Testar dispositivos'}</button></div>
  {busy&&<p className="text-sm text-slate-500">Termina a chamada em curso antes de testar os dispositivos.</p>}
  {error&&<p role="alert" className="chat-error">{error}</p>}
 </section>;
}
