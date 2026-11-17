// Deployment/authentication preflight against a REAL staging Supabase project.
// Sends only intentionally invalid credentials: cannot trigger work or email.
function required(name) {
  const value=process.env[name];
  if(!value) throw new Error(`Missing staging environment setting: ${name}`);
  return value;
}
const project=required('TERCIS_STAGING_PROJECT_REF');
const base=required('TERCIS_STAGING_URL');
if(base!==`https://${project}.supabase.co`)
  throw new Error('Preflight refused: target is not the exact confirmed staging project');
const names=['quote-email-worker','quote-email-webhook','attachment-scan-worker','operations-health'];
async function main() {
  for(const name of names) {
    const response=await fetch(`${base}/functions/v1/${name}`,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-tercis-worker-secret':'invalid-preflight-no-access',
        'svix-id':'fake-preflight',
        'svix-timestamp':'0',
        'svix-signature':'v1,invalid',
      },
      body:'{}',
      signal:AbortSignal.timeout(12000),
    });
    if(response.status!==401)
      throw new Error(`${name}: expected denied unauthenticated request (401), got HTTP ${response.status}. Check deployment and secrets.`);
    console.log(`PREFLIGHT PASS: ${name} deployed and rejects untrusted requests`);
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
