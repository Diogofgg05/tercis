import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {zipSync,strToU8} from 'fflate';
import {readSheet} from 'read-excel-file/node';
const source=await readFile(new URL('../../src/lib/catalogCsv.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {parseCatalogTable}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

export function workbookFixture(){
  const files={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Catálogo" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>codigo</t></is></c><c r="B1" t="inlineStr"><is><t>descricao</t></is></c><c r="C1" t="inlineStr"><is><t>custo</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>0001</t></is></c><c r="B2" t="inlineStr"><is><t>Disjuntor; curva C</t></is></c><c r="C2"><v>12.3456</v></c></row></sheetData></worksheet>',
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name,value])=>[name,strToU8(value)])));
}

test('actual XLSX workbook preserves text codes and four-decimal purchase prices',async()=>{
  const rows=await readSheet(Buffer.from(workbookFixture()),1,{parseNumber:value=>value});
  const imported=parseCatalogTable(rows);
  assert.equal(imported[0].code,'0001');assert.equal(imported[0].description,'Disjuntor; curva C');assert.equal(imported[0].unit_cost,12.3456);
});

test('spreadsheet imports reject duplicate headers, duplicate codes and invalid price precision',()=>{
  for(const rows of [
    [['codigo','descricao','custo','custo'],['A','Item',1,2]],
    [['codigo','descricao','custo'],['A','Item',1],['a','Duplicado',2]],
    [['codigo','descricao','custo'],['A','Item','1.12345']],
    [['codigo','descricao','custo'],['A','Item',new Date()]],
  ])assert.throws(()=>parseCatalogTable(rows));
});
