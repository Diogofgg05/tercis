import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../../src/domain/catalog-sector.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}});
const {catalogSector}=await import(`data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`);

test('editor sector IDs resolve to the database catalog labels',()=>{
  for(const [input,expected] of [['eletricidade','Eletricidade'],['iluminacao','Iluminação'],['automacao','Automação'],[' Iluminação ','Iluminação']]) {
    assert.equal(catalogSector(input),expected);
  }
});

test('the all-sectors filter and additional company sectors remain supported',()=>{
  assert.equal(catalogSector(''),'');
  assert.equal(catalogSector('Instrumentação'),'Instrumentação');
});
