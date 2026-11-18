// Read-only, exhaustive, byte-level Storage recovery verification.
// Run AFTER an operator restores all staging buckets to a DISTINCT recovery
// Supabase project. No paths, tokens, emails, or object bytes are logged.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const required=name=>{
  const value=process.env[name];
  if(!value)throw new Error(`Missing staging-only setting: ${name}`);
  return value;
};
const sourceRef=required('TERCIS_STAGING_PROJECT_REF');
const targetRef=required('TERCIS_RECOVERY_STAGING_PROJECT_REF');
if(!/^[a-z0-9]{20}$/.test(sourceRef) || !/^[a-z0-9]{20}$/.test(targetRef) ||
  sourceRef===targetRef ||
  required('TERCIS_STAGING_CONFIRM')!==sourceRef ||
  required('TERCIS_RECOVERY_STAGING_CONFIRM')!==targetRef)
  throw new Error('Storage audit refused: two different explicitly confirmed staging refs required');
const sourceUrl=required('TERCIS_STAGING_URL');
const targetUrl=required('TERCIS_RECOVERY_STAGING_URL');
if(sourceUrl!==`https://${sourceRef}.supabase.co` ||
  targetUrl!==`https://${targetRef}.supabase.co`)
  throw new Error('Storage audit refused: unexpected Supabase project origin');
const maxFiles=Number(process.env.TERCIS_RECOVERY_MAX_FILES||2000);
if(!Number.isSafeInteger(maxFiles)||maxFiles<1||maxFiles>10000)
  throw new Error('Invalid staging-only file safety limit');
const makeClient=(url,key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const source=makeClient(sourceUrl,required('TERCIS_STAGING_SERVICE_ROLE_KEY'));
const target=makeClient(targetUrl,required('TERCIS_RECOVERY_STAGING_SERVICE_ROLE_KEY'));

async function buckets(client){
  const {data,error}=await client.storage.listBuckets();
  if(error||!data)throw error||new Error('Cannot list staging buckets');
  return data.filter(b=>b.id).map(b=>({id:b.id,public:b.public})).sort((a,b)=>a.id.localeCompare(b.id));
}
async function enumerate(client,bucket){
  const paths=[];
  const folders=[''];
  while(folders.length){
    const prefix=folders.pop();
    for(let offset=0;;offset+=1000){
      const {data,error}=await client.storage.from(bucket).list(prefix,{
        limit:1000,offset,sortBy:{column:'name',order:'asc'},
      });
      if(error||!data)throw error||new Error('Storage listing unavailable');
      for(const item of data){
        const name=prefix?`${prefix}/${item.name}`:item.name;
        if(item.id===null)folders.push(name);
        else if(item.id)paths.push(name);
        else throw new Error('Unrecognized Storage listing entry');
        if(paths.length>maxFiles)throw new Error('Recovery audit file cap exceeded; cannot claim complete verification');
      }
      if(data.length<1000)break;
    }
  }
  return paths.sort();
}
async function fingerprint(client,bucket,path){
  const {data,error}=await client.storage.from(bucket).download(path);
  if(error||!data)throw error||new Error('Recovered object missing');
  const bytes=Buffer.from(await data.arrayBuffer());
  return {bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function main(){
  const a=await buckets(source);
  const b=await buckets(target);
  if(JSON.stringify(a)!==JSON.stringify(b))
    throw new Error('RESTORE FAILED: Storage buckets or public/private flags differ');
  let total=0;
  for(const bucket of a){
    const original=await enumerate(source,bucket.id);
    const restored=await enumerate(target,bucket.id);
    if(JSON.stringify(original)!==JSON.stringify(restored))
      throw new Error('RESTORE FAILED: Storage object inventory mismatch');
    for(const path of original){
      if(++total>maxFiles)throw new Error('RESTORE FAILED: total object cap exceeded');
      const src=await fingerprint(source,bucket.id,path);
      const dest=await fingerprint(target,bucket.id,path);
      if(src.bytes!==dest.bytes||src.sha256!==dest.sha256)
        throw new Error('RESTORE FAILED: Storage object checksum mismatch');
    }
  }
  if(a.length===0 || total===0)
    throw new Error('RESTORE FAILED: no Storage objects were available to prove byte recovery');
  console.log(`STAGING STORAGE RESTORE AUDIT PASS: ${a.length} buckets and ${total} objects verified by SHA-256`);
  console.log('This proves the compared snapshot only; verify PITR, RPO/RTO, and retention separately.');
}
main().catch(error=>{
  console.error('STAGING STORAGE AUDIT FAILED:',error instanceof Error?error.message:'Unknown error');
  process.exitCode=1;
});
