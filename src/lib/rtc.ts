export function rtcConfiguration(configured?:string):RTCConfiguration {
 if(configured){
  const parsed:unknown=JSON.parse(configured);
  if(!Array.isArray(parsed)||!parsed.every(entry=>entry&&typeof entry==='object'&&'urls' in entry))
   throw new Error('A configuração de rede das chamadas é inválida.');
  return {iceServers:parsed as RTCIceServer[]};
 }
 return {iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
}

/** Candidates can arrive before SDP or twice after a realtime reconnect. */
export class RemoteCandidates {
 private pending:RTCIceCandidateInit[]=[];
 private seen=new Set<string>();
 private flushing=false;
 push(candidate:RTCIceCandidateInit){
  const key=JSON.stringify([candidate.candidate,candidate.sdpMid,candidate.sdpMLineIndex]);
  if(this.seen.has(key))return;
  this.seen.add(key);this.pending.push(candidate);
 }
 async flush(pc:RTCPeerConnection){
  const isClosed=()=>pc.signalingState==='closed';
  if(this.flushing||!pc.remoteDescription||isClosed())return;
  this.flushing=true;
  try {
   while(this.pending.length&&!isClosed()){
    const next=this.pending.shift()!;await pc.addIceCandidate(next);
   }
  }finally{this.flushing=false;}
 }
}

/** Store a complete SDP, avoiding lost ICE messages during call setup. */
export async function completeDescription(pc:RTCPeerConnection,timeoutMs=10000):Promise<RTCSessionDescriptionInit> {
 if(pc.iceGatheringState!=='complete'&&pc.signalingState!=='closed')await new Promise<void>(resolve=>{
  const finish=()=>{globalThis.clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',check);pc.removeEventListener('signalingstatechange',check);resolve();};
  const check=()=>{if(pc.iceGatheringState==='complete'||pc.signalingState==='closed')finish();};
  const timeout=globalThis.setTimeout(finish,timeoutMs);pc.addEventListener('icegatheringstatechange',check);pc.addEventListener('signalingstatechange',check);check();
 });
 if(pc.signalingState==='closed'||!pc.localDescription)throw new Error('A chamada foi cancelada.');
 return pc.localDescription.toJSON();
}
