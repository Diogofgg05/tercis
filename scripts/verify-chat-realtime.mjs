// Explicit opt-in integration test. No emails; credentials stay in memory.
// Creates a separate QA organization, never uses existing people's conversations.
import {createClient} from '@supabase/supabase-js';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

if(!process.argv.includes('--allow-temporary-auth-users'))throw new Error('Explicit temporary-user opt-in required');
const env=Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
const secret=process.env.TERCIS_QA_SUPABASE_SECRET;
if(!secret)throw new Error('Server-side QA secret required');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.VITE_SUPABASE_URL,secret,options);
const clients=[];const users=[];const callIds=[];const messageIds=[];
const orgId=randomUUID();let organizationCreated=false;const events=[];const checks=[];
const unwrap=result=>{if(result.error)throw new Error(result.error.code||result.error.message);return result.data;};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(predicate,label){const until=Date.now()+15000;while(Date.now()<until){if(predicate()){checks.push(label);return;}await pause(100);}throw new Error('Timed out: '+label);}
try{
 unwrap(await admin.from('organizations').insert({id:orgId,slug:'qa-rtc-'+orgId,name:'QA isolated realtime verification'}));organizationCreated=true;
 for(const suffix of ['a','b']){
  const email='qa-rtc-'+randomUUID()+'-'+suffix+'@example.invalid';const password=randomBytes(24).toString('base64url')+'!9';
  const data=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'QA realtime '+suffix}}));
  users.push(data.user.id);
  unwrap(await admin.from('profiles').update({organization_id:orgId,active:true,role:'collaborator',collaborator_type:'internal'}).eq('id',data.user.id));
  const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options);clients.push(client);
  const auth=unwrap(await client.auth.signInWithPassword({email,password}));
  await client.realtime.setAuth(auth.session.access_token);
  unwrap(await client.rpc('tercis_chat_contacts'));
 }
 const channels=clients.map((client,index)=>client.channel('qa-realtime-'+randomUUID())
  .on('system',{},p=>console.log(JSON.stringify({system:index,status:p.status,message:p.message})))
  .on('postgres_changes',{event:'*',schema:'public',table:'tercis_calls'},p=>events.push({client:index,table:'calls',type:p.eventType,row:p.new}))
  .on('postgres_changes',{event:'*',schema:'public',table:'tercis_direct_messages'},p=>events.push({client:index,table:'messages',type:p.eventType,row:p.new}))
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'tercis_call_ice'},p=>events.push({client:index,table:'ice',type:p.eventType,row:p.new})));
 await Promise.all(channels.map(channel=>new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Realtime subscribe timed out')),15000);
  channel.subscribe((status,error)=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}else if(status==='CHANNEL_ERROR'){clearTimeout(timeout);reject(new Error('Realtime subscribe failed: '+(error?.message||status)));}});
 })));
 const [a,b]=clients;
 const message=unwrap(await a.rpc('tercis_send_direct_message',{p_recipient:users[1],p_body:'Isolated QA receipt check'}));messageIds.push(message);
 const readback=unwrap(await b.from('tercis_direct_messages').select('id').eq('id',message));
 console.log(JSON.stringify({receiverCanRead:readback.length===1}));
 await waitFor(()=>events.some(e=>e.client===1&&e.table==='messages'&&e.row.id===message),'recipient receives message INSERT');
 unwrap(await b.rpc('tercis_mark_direct_messages_read',{p_peer:users[0],p_message_ids:[message]}));
 await waitFor(()=>events.some(e=>e.client===0&&e.table==='messages'&&e.row.id===message&&e.row.read_at),'sender receives read receipt UPDATE');
 const call=unwrap(await a.rpc('tercis_start_call',{p_peer:users[1],p_kind:'video',p_offer:{type:'offer',sdp:'v=0 isolated signaling verification'}}));callIds.push(call);
 await waitFor(()=>events.some(e=>e.client===1&&e.table==='calls'&&e.row.id===call&&e.row.status==='ringing'),'callee receives incoming call');
 unwrap(await a.rpc('tercis_add_call_ice',{p_call_id:call,p_candidate:{candidate:'candidate:qa-test 1 udp 1 192.0.2.1 12345 typ host',sdpMid:'0',sdpMLineIndex:0}}));
 await waitFor(()=>events.some(e=>e.client===1&&e.table==='ice'&&e.row.call_id===call),'callee receives ICE candidate');
 unwrap(await b.rpc('tercis_update_call',{p_id:call,p_status:'accepted',p_answer:{type:'answer',sdp:'v=0 isolated signaling answer verification'}}));
 await waitFor(()=>events.some(e=>e.client===0&&e.table==='calls'&&e.row.id===call&&e.row.status==='accepted'),'caller receives acceptance');
 unwrap(await a.rpc('tercis_update_call',{p_id:call,p_status:'ended'}));
 await waitFor(()=>events.some(e=>e.client===1&&e.table==='calls'&&e.row.id===call&&e.row.status==='ended'),'callee receives hangup');
 console.log(JSON.stringify({result:'passed',checks}));
}catch(error){console.error(JSON.stringify({result:'failed',checks,error:error.message}));process.exitCode=1;}
finally{
 const cleanupErrors=[];
 const clean=async(label,action)=>{try{unwrap(await action());}catch(error){cleanupErrors.push({label,error:error.message});}};
 for(const client of clients){await client.removeAllChannels();await client.auth.signOut();}
 if(callIds.length)await clean('calls',()=>admin.from('tercis_calls').delete().in('id',callIds));
 if(messageIds.length)await clean('messages',()=>admin.from('tercis_direct_messages').delete().in('id',messageIds));
 for(const id of users)await clean('auth user',()=>admin.auth.admin.deleteUser(id));
 if(organizationCreated)await clean('QA organization',()=>admin.from('organizations').delete().eq('id',orgId).like('slug','qa-rtc-%'));
 console.log(JSON.stringify({cleanup:cleanupErrors.length?'failed':'passed',errors:cleanupErrors,...(cleanupErrors.length?{orgId,userIds:users}:{} )}));
 if(cleanupErrors.length)process.exitCode=1;
}
