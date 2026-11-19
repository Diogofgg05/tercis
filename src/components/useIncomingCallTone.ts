import { useEffect,useRef } from 'react';

/** Browser audio is unlocked by an ordinary user gesture, never by a permission prompt. */
export function useIncomingCallTone(incoming:boolean){
 const context=useRef<AudioContext|null>(null);
 useEffect(()=>{
  const unlock=()=>{
   if(typeof AudioContext==='undefined')return;
   context.current??=new AudioContext();void context.current.resume().catch(()=>{});
  };
  window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
  return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);void context.current?.close();context.current=null;};
 },[]);
 useEffect(()=>{
  if(!incoming||typeof AudioContext==='undefined')return;
  context.current??=new AudioContext();const audio=context.current;
  let alive=true;const tones=new Set<OscillatorNode>();
  const ring=()=>{
   void audio.resume().then(()=>{
    if(!alive||audio.state!=='running')return;
    for(const delay of [0,.35]){
     const oscillator=audio.createOscillator();const volume=audio.createGain();
     oscillator.type='sine';oscillator.frequency.value=660;
     volume.gain.setValueAtTime(0,audio.currentTime+delay);volume.gain.linearRampToValueAtTime(.12,audio.currentTime+delay+.02);volume.gain.linearRampToValueAtTime(0,audio.currentTime+delay+.25);
     oscillator.connect(volume);volume.connect(audio.destination);tones.add(oscillator);
     oscillator.onended=()=>{tones.delete(oscillator);oscillator.disconnect();volume.disconnect();};
     oscillator.start(audio.currentTime+delay);oscillator.stop(audio.currentTime+delay+.27);
    }
   }).catch(()=>{});
  };
  ring();const timer=window.setInterval(ring,2200);
  return()=>{alive=false;window.clearInterval(timer);for(const tone of tones){try{tone.stop();}catch{/* Already stopped. */}}};
 },[incoming]);
}
