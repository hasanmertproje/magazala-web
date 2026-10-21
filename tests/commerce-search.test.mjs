import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(path) {
  const raw = await readFile(new URL(path, import.meta.url),'utf8');
  const output = ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
}
const {parseCommerceSearch,productSearchCondition,orderSearchCondition,parseProductStatus,commercePageUrl}
  = await load('../apps/web/lib/commerce-search.ts');
test('commerce searches are whitespace normalized and bounded',()=>{
  assert.equal(parseCommerceSearch('  SKU-123  '),'SKU-123');
  assert.equal(parseCommerceSearch(undefined),'');
  assert.equal(parseCommerceSearch('a'.repeat(400)).length,80);
});
test('product and order searches preserve distinct tenant-scoped field contracts',()=>{
  assert.deepEqual(productSearchCondition(''),{});
  assert.deepEqual(orderSearchCondition(''),{});
  assert.deepEqual(productSearchCondition('ABC').OR.map(row=>Object.keys(row)[0]),
    ['name','internalSku','internalBarcode']);
  assert.deepEqual(orderSearchCondition('ORD').OR.map(row=>Object.keys(row)[0]),
    ['orderNumber','customerReference']);
  for(const query of [productSearchCondition('ABC'),orderSearchCondition('ORD')]){
    assert.ok(query.OR.every(row=>Object.values(row)[0].mode==='insensitive'));
  }
  assert.equal(parseProductStatus('DRAFT'),'DRAFT');
  assert.equal(parseProductStatus('ACTIVE'),'ACTIVE');
  assert.equal(parseProductStatus('weird'),undefined);
});
test('deep links persist query and status without leaking page state',()=>{
  assert.equal(commercePageUrl('/commerce/products',2,{q:'desk lamp',status:'DRAFT'}),
    '/commerce/products?status=DRAFT&q=desk+lamp&page=2');
  assert.equal(commercePageUrl('/commerce/orders',1,{q:'SKU /-X'}),
    '/commerce/orders?q=SKU+%2F-X');
  assert.equal(commercePageUrl('/commerce/products',1),'/commerce/products');
});
test('page and API both apply the same search predicates and server pagination',async()=>{
  for(const [page,api,condition] of [
    ['../apps/web/app/(dashboard)/commerce/products/page.tsx','../apps/web/app/api/commerce/products/route.ts','productSearchCondition'],
    ['../apps/web/app/(dashboard)/commerce/orders/page.tsx','../apps/web/app/api/commerce/orders/route.ts','orderSearchCondition']
  ]){
    const [view,route] = await Promise.all([readFile(new URL(page,import.meta.url),'utf8'),
      readFile(new URL(api,import.meta.url),'utf8')]);
    for(const src of [view,route]){
      assert.ok(src.includes(condition+'(search)'));
      assert.ok(src.includes('parseCommerceSearch('));
      assert.ok(src.includes('skip:')||src.includes('skip:('));
    }
  }
});
