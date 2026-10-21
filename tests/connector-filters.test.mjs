import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../apps/web/lib/connector-filters.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseConnectorFilter,connectorPageUrl,connectorCredentialState}=
  await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

test('connector filters accept only known operational states',()=>{
  for(const state of ['MOCK','ERROR','VERIFIED','UNVERIFIED']) assert.equal(parseConnectorFilter(state),state);
  assert.equal(parseConnectorFilter('LIVE_SYNC'),undefined);
  assert.equal(parseConnectorFilter(''),undefined);
});

test('mock is never shown as live validated credentials',()=>{
  const record={mode:'MOCK',enabled:true,lastValidatedAt:new Date(),lastErrorCode:null};
  assert.equal(connectorCredentialState(record),'SIMULATED');
  assert.equal(connectorCredentialState({...record,mode:'STAGE',lastErrorCode:'AUTH_FAILED'}),'ERROR');
  assert.equal(connectorCredentialState({...record,mode:'PRODUCTION',enabled:false,lastErrorCode:null}),'INACTIVE');
  assert.equal(connectorCredentialState({...record,mode:'STAGE'}),'VERIFIED');
  assert.equal(connectorCredentialState({...record,mode:'STAGE',lastValidatedAt:null}),'UNVERIFIED');
});

test('connector filters persist in paginated URL and use bounded user search',()=>{
  assert.equal(connectorPageUrl(2,'mağaza 10','ERROR'),
    '/commerce/stores?status=ERROR&q=ma%C4%9Faza+10&page=2');
  assert.equal(connectorPageUrl(1),'/commerce/stores');
});
