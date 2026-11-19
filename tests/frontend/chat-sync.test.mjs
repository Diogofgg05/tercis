import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../../src/lib/chatSync.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
const {mergeMessages,canApplyCallUpdate}=await import(`data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`);
test('history snapshots cannot erase a newer read receipt',()=>{
 const message={id:'one',created_at:'2026-11-18T21:00:00Z',read_at:null};
 const seen={...message,read_at:'2026-11-18T21:01:00Z'};
 assert.equal(mergeMessages([seen],[message])[0].read_at,seen.read_at);
 assert.equal(mergeMessages([message],[seen])[0].read_at,seen.read_at);
});
test('realtime and recovery snapshots deduplicate and retain stable chronological order',()=>{
 const one={id:'a',created_at:'2026-11-18T21:00:00Z',read_at:null};
 const two={...one,id:'b'};const later={...one,id:'c',created_at:'2026-11-18T21:01:00Z'};
 assert.deepEqual(mergeMessages([later,two],[one,two]).map(m=>m.id),['a','b','c']);
});
test('missed acceptance and hangup can be applied without regressing to an older ringing snapshot',()=>{
 const ringing={id:'call',status:'ringing',updated_at:'2026-11-18T21:00:00Z'};
 const accepted={...ringing,status:'accepted',updated_at:'2026-11-18T21:00:03Z'};
 const ended={...accepted,status:'ended',updated_at:'2026-11-18T21:00:05Z'};
 assert.equal(canApplyCallUpdate(ringing,accepted),true);
 assert.equal(canApplyCallUpdate(accepted,ringing),false);
 assert.equal(canApplyCallUpdate(accepted,{...ringing,updated_at:accepted.updated_at}),false);
 assert.equal(canApplyCallUpdate(accepted,ended),true);
 assert.equal(canApplyCallUpdate(ended,accepted),false);
 assert.equal(canApplyCallUpdate(accepted,{...ended,id:'another-call'}),false);
});
