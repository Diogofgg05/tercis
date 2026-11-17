// Test one real Supabase Storage object restored to an INDEPENDENT staging
// recovery project, with SHA-256 integrity check. Never run on production.
// This validates recovery of one object, NOT a full Storage backup.
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';

const required=(name)=>{
  const value=process.env[name];
  if(!value)throw new Error(`Missing staging-only secret: ${name}`);
  return value;
};
const sourceRef=required('TERCIS_STAGING_PROJECT_REF');
const destRef=required('TERCIS_RECOVERY_STAGING_PROJECT_REF');
const sourceUrl=required('TERCIS_STAGING_URL');
const destUrl=required('TERCIS_RECOVERY_STAGING_URL');
if(sourceRef===destRef ||
  sourceUrl!==`https://${sourceRef}.supabase.co` ||
  destUrl!==`https://${destRef}.supabase.co` ||
  required('TERCIS_RECOVERY_STAGING_CONFIRM')!==destRef) {
  throw new Error('Recovery drill refused: source/target must be two explicitly confirmed staging projects');
}
const path=required('TERCIS_STAGING_TEST_PRIVATE_FILE_PATH');
const budget=required('TERCIS_STAGING_TEST_BUDGET_ID');
const org=required('TERCIS_STAGING_TEST_ORGANIZATION_ID');
if(!path.startsWith(`${org}/${budget}/`) || path.split('/').length!==3)
  throw new Error('Recovery fixture must belong to explicitly confirmed staging organization/quote');
const client=(url,key)=>createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false},
});
const source=client(sourceUrl,required('TERCIS_STAGING_SERVICE_ROLE_KEY'));
const recovery=client(destUrl,required('TERCIS_RECOVERY_STAGING_SERVICE_ROLE_KEY'));
const BUCKET='tercis-private-attachments';
const bytes=(blob)=>blob.arrayBuffer().then(data=>Buffer.from(data));
const sha=(data)=>createHash('sha256').update(data).digest('hex');

async function main(){
  const {data:original,error:sourceError}=await source.storage.from(BUCKET).download(path);
  if(sourceError||!original||original.size<1)
    throw sourceError||new Error('No test source object can be recovered');
  const buffer=await bytes(original);
  if(buffer.length>10*1024*1024)throw new Error('Fixture exceeds safety limit');
  // The private bucket explicitly rejects application/octet-stream.
  // Reuse the original allowed MIME type instead of defaulting to binary.
  const mime=original.type;
  if(!['application/pdf','image/png','image/jpeg','image/webp','text/plain'].includes(mime))
    throw new Error('Recovery test source must have a supported MIME type');
  const {data:bucket,error:bucketError}=await recovery.storage.getBucket(BUCKET);
  if(bucketError||!bucket||bucket.public)
    throw new Error('Recovery project must already have a PRIVATE Tercis bucket configured');
  const fileName=`recovery-drill/${randomUUID()}.bin`;
  let created=false;
  try {
    const {error:uploadError}=await recovery.storage.from(BUCKET)
      .upload(fileName,buffer,{upsert:false,contentType:mime});
    if(uploadError)throw uploadError;
    created=true;
    const {data:restored,error:downloadError}=await recovery.storage.from(BUCKET)
      .download(fileName);
    if(downloadError||!restored)throw downloadError||new Error('Restored object missing');
    const copy=await bytes(restored);
    if(copy.length!==buffer.length || sha(copy)!==sha(buffer))
      throw new Error('Restored Storage checksum mismatch');
    console.log('STORAGE DRILL PASS: independent recovery staging project, object bytes and SHA256 match');
  } finally {
    if(created){
      const {error:removeError}=await recovery.storage.from(BUCKET).remove([fileName]);
      if(removeError)throw new Error('Recovery fixture cleanup failed; manual inspection required');
    }
  }
}
main().catch(error=>{
  console.error('RECOVERY DRILL FAILED:',error instanceof Error?error.message:'Unknown failure');
  process.exitCode=1;
});
