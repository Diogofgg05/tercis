// Read-only end-to-end checks against a real STAGING Supabase instance.
// Never run with production credentials or a production database.
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Required staging environment value missing: ${name}`);
  return value;
}
function base32Decode(value) {
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits=0, accumulator=0;
  const result=[];
  for(const char of value.toUpperCase().replace(/[^A-Z2-7]/g,'')){
    const digit=alphabet.indexOf(char);
    if(digit<0) throw new Error('Invalid Base32 character');
    accumulator=(accumulator<<5)|digit; bits+=5;
    if(bits>=8){bits-=8;result.push((accumulator>>bits)&255);}
  }
  return Buffer.from(result);
}
function totp(secret, timestamp=Date.now()) {
  const counter=Math.floor(timestamp/30000);
  const buffer=Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest=createHmac('sha1',base32Decode(secret)).update(buffer).digest();
  const offset=digest[digest.length-1]&15;
  const code=(digest.readUInt32BE(offset)&0x7fffffff)%1000000;
  return String(code).padStart(6,'0');
}
const url=requireEnv('TERCIS_STAGING_URL');
const anon=requireEnv('TERCIS_STAGING_ANON_KEY');
const stagingRef=requireEnv('TERCIS_STAGING_PROJECT_REF');
if(!new URL(url).hostname.includes(stagingRef)
  || !url.startsWith('https://')) throw new Error('Host does not match explicitly configured staging project reference');

const client = () => createClient(url,anon,{
  auth:{persistSession:false,autoRefreshToken:false},
});
async function loginAs(email,password) {
  const c=client();
  const {error}=await c.auth.signInWithPassword({email,password});
  if(error)throw new Error('Staging login failed: '+error.message);
  return c;
}
async function requireAal2(c,totpSecret) {
  let {data:levels,error}=await c.auth.mfa.getAuthenticatorAssuranceLevel();
  if(error)throw error;
  if(levels.currentLevel==='aal2') return;
  const {data:factors,error:factorError}=await c.auth.mfa.listFactors();
  if(factorError)throw factorError;
  const factor=factors.totp.find(f=>f.status==='verified');
  if(!factor)throw new Error('Staging administrator has no verified TOTP factor');
  const {data:challenge,error:challengeError}=await c.auth.mfa.challenge({factorId:factor.id});
  if(challengeError)throw challengeError;
  const {error:verifyError}=await c.auth.mfa.verify({
    factorId:factor.id,challengeId:challenge.id,code:totp(totpSecret),
  });
  if(verifyError)throw verifyError;
  ({data:levels,error}=await c.auth.mfa.getAuthenticatorAssuranceLevel());
  if(error || levels.currentLevel!=='aal2')
    throw new Error('Real Supabase Auth did not elevate session to AAL2');
}
async function main() {
  const budgetId=requireEnv('TERCIS_STAGING_TEST_BUDGET_ID');
  const orgId=requireEnv('TERCIS_STAGING_TEST_ORGANIZATION_ID');
  const admin=await loginAs(
    requireEnv('TERCIS_STAGING_ADMIN_EMAIL'),
    requireEnv('TERCIS_STAGING_ADMIN_PASSWORD'));
  const {data:adminSession,error:adminError}=await admin.auth.getUser();
  if(adminError || !adminSession.user)throw new Error('Admin session is invalid');
  const {data:myProfile,error:profileError}=await admin.from('profiles')
    .select('organization_id,role,active').eq('id',adminSession.user.id).single();
  if(profileError || myProfile?.organization_id!==orgId || !myProfile.active)
    throw new Error('Admin profile mismatch for staging organization');

  await requireAal2(admin,requireEnv('TERCIS_STAGING_ADMIN_TOTP_BASE32'));
  const {data:budgets,error:budgetsError}=await admin.from('budgets')
    .select('id,organization_id,status,version').eq('id',budgetId).single();
  if(budgetsError || budgets?.organization_id!==orgId)
    throw new Error('Admin cannot read seeded budget in its own organization');
  const {error:attachmentsError}=await admin.from('budget_attachments')
    .select('id').eq('budget_id',budgetId).limit(1);
  if(attachmentsError) throw new Error('Admin cannot query private attachment metadata: '+attachmentsError.message);
  // A real, previously uploaded STAGING fixture is mandatory. An empty
  // bucket cannot prove private-object download policies are correct.
  const privatePath=requireEnv('TERCIS_STAGING_TEST_PRIVATE_FILE_PATH');
  if(!privatePath.startsWith(orgId+'/'+budgetId+'/'))
    throw new Error('Private fixture path does not match the scoped organization/quote');
  const {data:ownedFile,error:ownedFileError}=await admin.storage
    .from('tercis-private-attachments').download(privatePath);
  if(ownedFileError || !ownedFile || ownedFile.size<1)
    throw new Error('Own organization must be able to download its seeded private file');


  const customer=await loginAs(
    requireEnv('TERCIS_STAGING_CLIENT_EMAIL'),
    requireEnv('TERCIS_STAGING_CLIENT_PASSWORD'));
  const {data:clientUser,error:clientError}=await customer.auth.getUser();
  if(clientError || !clientUser.user)throw new Error('Customer session is invalid');
  const {data:clientProfile}=await customer.from('profiles').select('role,active')
    .eq('id',clientUser.user.id).single();
  if(!clientProfile?.active || clientProfile.role!=='client')
    throw new Error('Test customer is not an active client');

  const {data:rawLines,error:rawError}=await customer.from('budget_items')
    .select('unit_cost,margin').eq('budget_id',budgetId).limit(1);
  if(!rawError && rawLines?.length)throw new Error('Customer can retrieve supplier cost/margin');

  const {data:rawAttachments,error:attachError}=await customer.from('budget_attachments')
    .select('file_path').eq('budget_id',budgetId).limit(1);
  if(!attachError && rawAttachments?.length)throw new Error('Customer sees private file paths');

  const {data:rawOutbox,error:outboxError}=await customer.from('quote_email_outbox')
    .select('recipient_email').eq('budget_id',budgetId).limit(1);
  if(!outboxError && rawOutbox?.length)throw new Error('Customer can retrieve email delivery table');

  const {data:rawStorage,error:storageError}=await customer.storage
    .from('tercis-private-attachments').list(`${orgId}/${budgetId}`,{limit:10});
  if(!storageError && rawStorage?.length)throw new Error('Customer can list private quote files');
  const {data:clientFile,error:clientFileError}=await customer.storage
    .from('tercis-private-attachments').download(privatePath);
  if(!clientFileError && clientFile)throw new Error('Customer downloaded real staff-only attachment');

  // Run this with two completely independent organizations. A single
  // organization cannot validate cross-tenant access boundaries.
  const otherOrgId=requireEnv('TERCIS_STAGING_OTHER_ORGANIZATION_ID');
  if(otherOrgId===orgId)throw new Error('Second staging org must differ');
  const otherAdmin=await loginAs(
    requireEnv('TERCIS_STAGING_OTHER_ADMIN_EMAIL'),
    requireEnv('TERCIS_STAGING_OTHER_ADMIN_PASSWORD'));
  await requireAal2(otherAdmin,requireEnv('TERCIS_STAGING_OTHER_ADMIN_TOTP_BASE32'));
  const {data:otherUser,error:otherUserError}=await otherAdmin.auth.getUser();
  if(otherUserError || !otherUser.user)throw new Error('Second staging admin session invalid');
  const {data:otherProfile,error:otherProfileError}=await otherAdmin.from('profiles')
    .select('organization_id,role,active').eq('id',otherUser.user.id).single();
  if(otherProfileError || !otherProfile?.active ||
    otherProfile.organization_id!==otherOrgId)
    throw new Error('Second admin belongs to the wrong staging organization');

  const {data:leakedQuote,error:otherQuoteError}=await otherAdmin.from('budgets')
    .select('id').eq('id',budgetId).limit(1);
  if(!otherQuoteError && leakedQuote?.length)
    throw new Error('OTHER ORGANIZATION CAN READ PRIVATE QUOTE');
  const {data:leakedFile,error:otherStorageError}=await otherAdmin.storage
    .from('tercis-private-attachments').download(privatePath);
  if(!otherStorageError && leakedFile)
    throw new Error('OTHER ORGANIZATION CAN DOWNLOAD PRIVATE FILE');
  await otherAdmin.auth.signOut();

  const {data:published,error:feedError}=await customer.rpc('tercis_client_quote_feed');
  if(feedError || !Array.isArray(published))
    throw new Error('Authenticated customer quote feed failed');
  if(JSON.stringify(published).includes('"unit_cost"')
    || JSON.stringify(published).includes('"margin"'))
    throw new Error('Published customer feed contains wholesale cost information');

  console.log('STAGING PASS: two real Supabase organizations, TOTP/AAL2, seeded attachment deny, customer privacy');
  await admin.auth.signOut();
  await customer.auth.signOut();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
