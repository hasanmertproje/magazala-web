import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../apps/web/lib/order-filters.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const {
  parseOrderFilter, orderStatusCondition, parsePage, clampPage, orderPageUrl,
}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

test('OPEN includes exactly the actionable statuses used in dashboard counts',()=>{
  assert.equal(parseOrderFilter('OPEN'),'OPEN');
  assert.deepEqual(orderStatusCondition('OPEN'),{status:{in:['NEW','CONFIRMED','PACKING']}});
  assert.deepEqual(orderStatusCondition('DELIVERED'),{status:'DELIVERED'});
  assert.deepEqual(orderStatusCondition(undefined),{});
  assert.equal(parseOrderFilter('OPEN OR 1=1'),undefined);
  assert.equal(parseOrderFilter(''),undefined);
});

test('bounded pages are strict and URLs preserve selected status',()=>{
  for(const bad of ['0','-1','1abc','1.5','Infinity','','10000000']){
    assert.equal(parsePage(bad),1);
  }
  assert.equal(parsePage('00001'),1);
  assert.equal(parsePage('102'),102);
  assert.equal(clampPage(100,57,50),2);
  assert.equal(clampPage(1,0,50),1);
  assert.equal(orderPageUrl('OPEN',2),'/commerce/orders?status=OPEN&page=2');
  assert.equal(orderPageUrl(undefined,1),'/commerce/orders');
});
