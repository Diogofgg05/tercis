import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const rows=JSON.parse(await readFile(new URL('../../data/reference-components.json',import.meta.url),'utf8'));
test('reference catalog has unique codes and manufacturer sources without invented prices',()=>{
 assert.equal(rows.length,28);assert.equal(new Set(rows.map(row=>row.code)).size,rows.length);
 const approved=['abb.com','hager.com','nord.com','se.com','siemens.com'];
 for(const row of rows){
  assert.ok(row.reference&&row.description&&row.brand);
  const url=new URL(row.source_url);assert.equal(url.protocol,'https:');
  assert.ok(approved.some(domain=>url.hostname===domain||url.hostname.endsWith(`.${domain}`)));
  assert.equal('unit_cost' in row,false);
 }
 assert.ok(rows.some(row=>row.brand==='ABB'));assert.ok(rows.some(row=>row.brand==='NORD'));assert.ok(rows.some(row=>row.brand==='Hager'));
});

test('expanded manufacturer catalog has 64 unique references and attributable local photographs',async()=>{
 const extra=JSON.parse(await readFile(new URL('../../data/additional-components.json',import.meta.url),'utf8'));
 const details=JSON.parse(await readFile(new URL('../../data/reference-details.json',import.meta.url),'utf8'));
 const photos=JSON.parse(await readFile(new URL('../../data/catalog-images.json',import.meta.url),'utf8'));
 const all=[...details,...extra];assert.equal(all.length,64);
 assert.equal(new Set(all.map(r=>r.code)).size,64);assert.equal(new Set(all.map(r=>r.brand)).size,12);
 const manufacturers=['wago.com','phoenixcontact.com','omron.com','eaton.com','findernet.com','meanwell.com','weidmueller.com'];
 for(const row of extra){
  const source=new URL(row.source_url);assert.equal(source.protocol,'https:');
  assert.ok(manufacturers.some(d=>source.hostname===d||source.hostname.endsWith('.'+d)),row.code);
  assert.ok(Object.keys(row.specifications).length>0);assert.equal('unit_cost' in row,false);
 }
 for(const row of all.filter(r=>r.image_url)){
  assert.ok(row.image_url.startsWith('/catalog/'));
  assert.ok(existsSync(new URL('../../public'+row.image_url,import.meta.url)),row.image_url);
  assert.ok(photos.some(p=>p.path===row.image_url&&p.codes.includes(row.code)));
  assert.ok(row.image_caption);
 }
 assert.equal(all.filter(r=>r.image_url).length,45);
 const wdu=all.find(r=>r.reference==='1020000000');
 assert.equal(wdu.specifications['Cor'],'Bege escuro');
 assert.equal(wdu.specifications['Corrente nominal IEC'],'24 A');
 assert.equal(all.find(r=>r.reference==='1020280000').specifications['Corrente nominal IEC'],'41 A');
 assert.equal(all.find(r=>r.reference==='ESC225').specifications['Corrente AC-3'],'8,5 A');
 for(const photo of photos){assert.equal(new URL(photo.source_url).protocol,'https:');assert.ok(photo.manufacturer);}
});
