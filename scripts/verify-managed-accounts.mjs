// Explicitly authorized integration test: two temporary identities in an isolated
// QA company. Credentials remain in memory; all data is removed in finally.
import {createClient} from '@supabase/supabase-js';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
if(!process.argv.includes('--allow-temporary-auth-users'))throw new Error('Temporary-user opt-in required');
const env=Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
if(!process.env.TERCIS_QA_SUPABASE_SECRET)throw new Error('QA secret required');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.VITE_SUPABASE_URL,process.env.TERCIS_QA_SUPABASE_SECRET,options);
const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options);
const ids=[];const org=randomUUID();let orgCreated=false;const checks=[];
const email='qa-managed-'+randomUUID()+'@example.invalid';
const newEmail='qa-managed-'+randomUUID()+'@example.invalid';
const password=randomBytes(24).toString('base64url')+'!9';
const unwrap=r=>{if(r.error)throw new Error(r.error.code||r.error.message);return r.data;};
function otp(secret){
 let bits='';for(const c of secret.replace(/=/g,'').toUpperCase())bits+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5,'0');
 const key=Buffer.from((bits.match(/.{8}/g)||[]).map(b=>parseInt(b,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const hash=createHmac('sha1',key).update(counter).digest();const offset=hash[hash.length-1]&15;
 return ((hash.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');
}
async function invoke(body){const result=await client.functions.invoke('create-team-account',{body});if(result.error){let detail;try{detail=await result.error.context.json();}catch{}return {status:result.error.context?.status||0,error:detail?.error||detail?.message||result.error.message};}return {status:200,data:result.data};}
try{
 unwrap(await admin.from('organizations').insert({id:org,slug:'qa-managed-'+org,name:'QA isolated managed accounts'}));orgCreated=true;
 const identity=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'QA company administrator'}}));ids.push(identity.user.id);
 unwrap(await admin.from('profiles').update({organization_id:org,role:'company_admin',active:true}).eq('id',identity.user.id));
 unwrap(await client.auth.signInWithPassword({email,password}));
 const body={email:newEmail,full_name:'QA managed collaborator',password,confirm_email_ownership:true};
 const aal1=await invoke(body);if(![401,403].includes(aal1.status))throw new Error('AAL1 request was not denied');checks.push('AAL1 account creation denied');
 const factor=unwrap(await client.auth.mfa.enroll({factorType:'totp',friendlyName:'QA isolated MFA'}));
 unwrap(await client.auth.mfa.challengeAndVerify({factorId:factor.id,code:otp(factor.totp.secret)}));
 const cross=await invoke({...body,organization_id:randomUUID()});if(cross.status!==403)throw new Error('Cross-tenant creation not denied: '+JSON.stringify(cross));checks.push('Cross-tenant creation denied');
 const promotion=await invoke({...body,role:'company_admin'});if(promotion.status!==403)throw new Error('Company admin promotion not denied');checks.push('Company administrator cannot appoint peers');
 const created=await invoke(body);if(created.status!==200||!created.data?.id)throw new Error('Creation failed: '+JSON.stringify(created));ids.push(created.data.id);checks.push('Managed collaborator created at AAL2');
 const employee=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,options);
 unwrap(await employee.auth.signInWithPassword({email:newEmail,password}));
 const profile=unwrap(await employee.from('profiles').select('role,active,organization_id').eq('id',created.data.id).single());
 if(!profile.active||profile.role!=='collaborator'||profile.organization_id!==org)throw new Error('Created account scope invalid');checks.push('Collaborator can sign in with correct scope');
 await employee.auth.signOut();
 console.log(JSON.stringify({result:'passed',checks}));
}catch(error){console.error(JSON.stringify({result:'failed',checks,error:error.message}));process.exitCode=1;}
finally{
 const errors=[];const clean=async(name,fn)=>{try{unwrap(await fn());}catch(error){errors.push({name,error:error.message});}};
 await client.auth.signOut();
 // Include a committed user whose response might have been lost.
 const listed=await admin.auth.admin.listUsers({page:1,perPage:1000});for(const user of listed.data?.users||[])if(user.email===newEmail&&!ids.includes(user.id))ids.push(user.id);
 if(orgCreated)await clean('audit',()=>admin.from('audit_logs').delete().eq('organization_id',org));
 for(const id of ids)await clean('identity',()=>admin.auth.admin.deleteUser(id));
 if(orgCreated)await clean('organization',()=>admin.from('organizations').delete().eq('id',org).like('slug','qa-managed-%'));
 console.log(JSON.stringify({cleanup:errors.length?'failed':'passed',errors,...(errors.length?{org,ids}:{} )}));if(errors.length)process.exitCode=1;
}
