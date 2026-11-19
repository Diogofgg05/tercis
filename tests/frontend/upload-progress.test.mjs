import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const source=(await readFile(new URL('../../src/lib/uploadProgress.ts',import.meta.url),'utf8'))
  .replace(/^import[^;]+;\s*/gm,'').replace(/export /g,'');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nglobalThis.uploadFetch=uploadFetch;';
function fixture(){
  const requests=[];
  class XHR {
    upload={};headers={};status=200;responseText='{"Key":"private/path"}';sent=false;
    constructor(){requests.push(this);}
    open(method,url){this.method=method;this.url=url;}
    setRequestHeader(name,value){this.headers[name]=value;}
    getResponseHeader(){return 'application/json';}
    send(body){this.sent=true;this.body=body;}
    abort(){this.onabort?.();}
  }
  const context={Request,Response,Headers,DOMException,XMLHttpRequest:XHR};
  vm.runInNewContext(code,context);
  return {uploadFetch:context.uploadFetch,requests};
}

test('actual transmitted bytes report progress but stay below complete until metadata commits',async()=>{
  const {uploadFetch,requests}=fixture();const progress=[];const body=new Blob(['test']);
  const pending=uploadFetch(value=>progress.push(value))('https://example.test/storage/v1/object/private/path',{method:'POST',headers:{Authorization:'Bearer user-token',apikey:'publishable','x-upsert':'false'},body});
  const xhr=requests[0];assert.equal(xhr.headers.authorization,'Bearer user-token');assert.equal(xhr.headers['x-upsert'],'false');assert.equal(xhr.body,body);
  xhr.upload.onprogress({lengthComputable:true,loaded:50,total:100});xhr.upload.onprogress({lengthComputable:true,loaded:100,total:100});
  assert.deepEqual(progress,[48,95]);xhr.onload();assert.equal((await pending).status,200);
});

test('Storage authorization failure is preserved and cancelled uploads reject',async()=>{
  const {uploadFetch,requests}=fixture();
  const denied=uploadFetch(()=>{})('https://example.test/storage/v1/object/private/path',{method:'POST'});
  requests[0].status=403;requests[0].responseText='{"message":"Row-level security denied"}';requests[0].onload();assert.equal((await denied).status,403);
  const controller=new AbortController();
  const cancelled=uploadFetch(()=>{},controller.signal)('https://example.test/storage/v1/object/private/other',{method:'POST'});
  controller.abort();await assert.rejects(cancelled,{name:'AbortError'});
  const early=new AbortController();early.abort();
  await assert.rejects(uploadFetch(()=>{},early.signal)('https://example.test/storage/v1/object/private/early',{method:'POST'}),{name:'AbortError'});
  assert.equal(requests[2].sent,false);
});
