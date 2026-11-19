import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../../src/lib/rtc.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {completeDescription,rtcConfiguration,RemoteCandidates}=await import(`data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`);

class Peer extends EventTarget {
 iceGatheringState='gathering';signalingState='have-local-offer';
 localDescription={toJSON:()=>({type:'offer',sdp:'complete SDP with candidates'})};
 finish(){this.iceGatheringState='complete';this.dispatchEvent(new Event('icegatheringstatechange'));}
 close(){this.signalingState='closed';this.dispatchEvent(new Event('signalingstatechange'));}
}
test('call setup waits for gathered ICE candidates before returning SDP',async()=>{
 const peer=new Peer();let finished=false;
 const promise=completeDescription(peer).then(value=>{finished=true;return value;});
 await Promise.resolve();assert.equal(finished,false);peer.finish();
 assert.equal((await promise).sdp,'complete SDP with candidates');
});
test('cancelling while gathering ICE rejects immediately and does not return an offer',async()=>{
 const peer=new Peer();const promise=completeDescription(peer);peer.close();
 await assert.rejects(promise,/cancelada/);
});
test('ICE gathering timeout still returns gathered local description',async()=>{
 const peer=new Peer();assert.equal((await completeDescription(peer,1)).type,'offer');
});
test('TURN relay configuration is preserved and malformed settings fail clearly',()=>{
 const relay={urls:'turn:relay.example.test:3478',username:'temporary',credential:'limited'};
 assert.deepEqual(rtcConfiguration(JSON.stringify([relay])).iceServers,[relay]);
 assert.throws(()=>rtcConfiguration('{"urls":"wrong-shape"}'),/inválida/);
 assert.throws(()=>rtcConfiguration('[{}]'),/inválida/);
});
test('trickle ICE buffers candidates before SDP and ignores realtime duplicates',async()=>{
 const queue=new RemoteCandidates();const received=[];
 const peer={remoteDescription:null,signalingState:'stable',async addIceCandidate(value){received.push(value);}};
 const candidate={candidate:'candidate:first',sdpMid:'0',sdpMLineIndex:0};
 queue.push(candidate);queue.push({...candidate});await queue.flush(peer);assert.equal(received.length,0);
 peer.remoteDescription={type:'offer'};await queue.flush(peer);assert.deepEqual(received,[candidate]);
 await queue.flush(peer);assert.equal(received.length,1);
});
test('trickle ICE flush handles a candidate arriving while another is being applied',async()=>{
 const queue=new RemoteCandidates();const received=[];
 const first={candidate:'candidate:one'},second={candidate:'candidate:two'};
 const peer={remoteDescription:{type:'offer'},signalingState:'stable',async addIceCandidate(value){received.push(value);if(received.length===1){queue.push(second);await queue.flush(peer);}}};
 queue.push(first);await queue.flush(peer);assert.deepEqual(received,[first,second]);
});
test('closed calls never apply queued ICE candidates',async()=>{
 const queue=new RemoteCandidates();queue.push({candidate:'candidate:late'});
 await queue.flush({remoteDescription:{type:'offer'},signalingState:'closed',addIceCandidate(){throw new Error('Should not apply');}});
});
