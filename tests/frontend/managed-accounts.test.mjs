import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const source=(await readFile(new URL('../../supabase/functions/create-team-account/index.ts',import.meta.url),'utf8')).replace(/import\s*\{\s*createClient\s*\}[^;]+;/,'const createClient=globalThis.testCreateClient;');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const scope={actor_id:'actor',organization_id:'own-company',platform_admin:false};
function runtime({platform=false,authorized=true,session=true}={}){
 let handler;const calls=[];
 const caller={auth:{getUser:async()=>({data:{user:session?{id:'actor'}:null},error:null})},rpc:async(name,args)=>{calls.push({name,args});return authorized?{data:{...scope,platform_admin:platform},error:null}:{data:null,error:{message:'MFA required'}};}};
 const admin={auth:{admin:{createUser:async args=>{calls.push({name:'createUser',args});return {data:{user:{id:'new-user'}},error:null};}}},rpc:async(name,args)=>{calls.push({name,args});return {data:'new-user',error:null};}};
 let clients=0;
 vm.runInNewContext(code,{Request,Response,console,Deno:{env:{get:()=> 'server-only-test'},serve:fn=>{handler=fn;}},testCreateClient:()=>clients++===0?caller:admin});
 return {calls,invoke:async(body,headers={Authorization:'Bearer valid-test-session'})=>handler(new Request('https://example.test/create-team-account',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}))};
}
const body={full_name:'Managed User',email:'new@example.test',password:'a-strong-test-password',confirm_email_ownership:true};
test('unauthenticated and AAL1 requests cannot create identities',async()=>{
 const unauth=runtime({session:false});assert.equal((await unauth.invoke(body)).status,401);assert.equal(unauth.calls.length,0);
 const aal1=runtime({authorized:false});assert.equal((await aal1.invoke(body)).status,403);assert.ok(!aal1.calls.some(c=>c.name==='createUser'));
});
test('company administrator cannot appoint peer administrators or skip identity attestation',async()=>{
 const manager=runtime();assert.equal((await manager.invoke({...body,role:'company_admin'})).status,403);assert.ok(!manager.calls.some(c=>c.name==='createUser'));
 const unverified=runtime();assert.equal((await unverified.invoke({...body,confirm_email_ownership:false})).status,400);assert.ok(!unverified.calls.some(c=>c.name==='createUser'));
});
test('created accounts use server-authorized organization and are completed with the real actor',async()=>{
 const r=runtime();const response=await r.invoke(body);assert.equal(response.status,200);
 const create=r.calls.find(c=>c.name==='createUser');assert.equal(create.args.email_confirm,true);assert.equal(create.args.password,body.password);
 const completion=r.calls.find(c=>c.name==='tercis_complete_team_account');assert.equal(completion.args.p_organization_id,'own-company');assert.equal(completion.args.p_actor,'actor');assert.equal(completion.args.p_role,'collaborator');
 assert.equal((await response.json()).password,undefined);
});
test('platform owner may create a company administrator through the same verified scope',async()=>{
 const r=runtime({platform:true});assert.equal((await r.invoke({...body,role:'company_admin',organization_id:'selected-company'})).status,200);
 assert.equal(r.calls.find(c=>c.name==='tercis_complete_team_account').args.p_role,'company_admin');
});
