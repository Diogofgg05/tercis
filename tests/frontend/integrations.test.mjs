import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const source=await readFile(new URL('../../supabase/functions/_shared/integration-config.ts',import.meta.url),'utf8');
const configuration=await import(`data:text/javascript;base64,${Buffer.from(transpile(source)).toString('base64')}`);
const env={EMAIL_WORKER_SECRET:'test-worker',RESEND_API_KEY:'private-provider-key',RESEND_WEBHOOK_SECRET:'private-signature',TERCIS_EMAIL_FROM:'propostas@example.test',TERCIS_APP_URL:'https://example.test'};

async function runtime(file,values=env,{session=true,owner=true,aal2=true}={}){
  const source=(await readFile(new URL(`../../supabase/functions/${file}/index.ts`,import.meta.url),'utf8'))
    .replace(/import\s*\{\s*createClient\s*\}[^;]+;/,'const createClient=globalThis.testCreateClient;')
    .replace(/import\s*\{[^}]+\}[^;]*integration-config.ts';/,'const {emailConfiguration,integrationConfiguration}=globalThis.configuration;');
  let handler;const calls=[];
  const client={auth:{getUser:async()=>({data:{user:session?{id:'actor'}:null},error:null})},rpc:async name=>{calls.push(name);return {data:aal2?{platform_admin:owner}:null,error:aal2?null:{message:'MFA required'}};}};
  vm.runInNewContext(transpile(source),{Request,Response,URL,console,configuration,Deno:{env:{get:name=>values[name]},serve:fn=>{handler=fn;}},testCreateClient:()=>{calls.push('client');return client;}});
  return {calls,invoke:headers=>handler(new Request('https://example.test/function',{method:'POST',headers}))};
}

test('email is opt-in; disabling it consumes no jobs and sends no provider request',async()=>{
  const r=await runtime('quote-email-worker');
  const response=await r.invoke({'x-tercis-worker-secret':'test-worker'});
  assert.equal(response.status,200);assert.equal((await response.json()).status,'disabled');assert.equal(r.calls.length,0);
  assert.equal((await r.invoke({})).status,401);
});

test('incomplete enabled email configuration fails before claiming the queue',async()=>{
  const r=await runtime('quote-email-worker',{EMAIL_WORKER_SECRET:'test-worker',TERCIS_EMAIL_ENABLED:'true'});
  const response=await r.invoke({'x-tercis-worker-secret':'test-worker'});
  assert.equal(response.status,503);assert.equal(r.calls.length,0);
  assert.ok((await response.json()).missing.includes('RESEND_API_KEY'));
  assert.equal(configuration.emailConfiguration(n=>({...env,TERCIS_EMAIL_ENABLED:'true'})[n]).ready,true);
  assert.equal(configuration.emailConfiguration(n=>({...env,TERCIS_EMAIL_ENABLED:'true',TERCIS_APP_URL:'javascript:alert(1)'})[n]).ready,false);
});

test('readiness requires the actual platform owner, verified MFA and a valid session',async()=>{
  for(const options of [{session:false},{owner:false},{aal2:false}]){
    const r=await runtime('platform-readiness',env,options);
    assert.ok([401,403].includes((await r.invoke({Authorization:'Bearer test-session'})).status));
  }
  const owner=await runtime('platform-readiness');const response=await owner.invoke({Authorization:'Bearer test-session'});
  assert.equal(response.status,200);const body=await response.text();
  assert.ok(!body.includes('private-provider-key')&&!body.includes('private-signature'));
  assert.equal(JSON.parse(body).billing.enabled,false);
});
