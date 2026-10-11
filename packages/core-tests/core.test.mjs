import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { evaluateEntitlement, routeModel, createInternalSku, createInternalBarcode, normalizeDiscoveryAnalysis } = require('../core-dist/index.js');

test('entitlement allows within quota and rejects exhausted quota', () => {
  const entitlements = [{ feature: 'ai.design.generate', enabled: true, limit: 2 }];
  assert.deepEqual(evaluateEntitlement('ai.design.generate', entitlements, [{ feature: 'ai.design.generate', used: 1 }]), { allowed: true, remaining: 1 });
  assert.deepEqual(evaluateEntitlement('ai.design.generate', entitlements, [{ feature: 'ai.design.generate', used: 2 }]), { allowed: false, reason: 'QUOTA_EXHAUSTED' });
});

test('router enforces hard capabilities and health', () => {
  const mk = (id, caps, health='healthy', benchmark=8) => ({ model:{id,providerId:id,name:id,enabled:true,capabilities:caps,benchmark:{logo:benchmark},costScore:2,latencyMsP50:500,failureRate:0.01,commercialUseAllowed:true}, runtime:{providerId:id,health,quotaRemaining:100,adminPriority:1,fallbackPriority:1} });
  const decision = routeModel({ operation:'logo', qualityProfile:'VECTOR_PREFERRED', requiredCapabilities:['native_vector'], preferredCapabilities:['text_rendering'], benchmarkCategory:'logo', requireCommercialUse:true }, [mk('raster',['text_to_image']),mk('vector',['native_vector','text_rendering'])]);
  assert.equal(decision.selected.model.id, 'vector');
});

test('internal identifiers remain deterministic and separate from GTIN', () => {
  assert.equal(createInternalSku({ prefix:'stk', sequence:42 }), 'STK-000042');
  assert.match(createInternalBarcode(210, 42), /^210000000042\d$/);
});

test('requirement normalization removes duplicate whitespace values', () => {
  const normalized = normalizeDiscoveryAnalysis({ understoodNeed:' x ', proposedBehavior:' y ', openQuestions:[' A ','A'], contradictions:[], requirements:[{ title:' Test ', module:' Inventory ', category:'FEATURE_REQUEST', description:' Desc ', confirmedRequirements:['One',' One '], acceptanceSuggestions:[], openQuestions:[], risks:[], dependencies:[], outOfScope:[] }]});
  assert.equal(normalized.requirements[0].title, 'Test');
  assert.deepEqual(normalized.requirements[0].confirmedRequirements, ['One']);
});

test('workspace scope rejects cross-tenant access', () => {
  const { assertWorkspaceAccess } = require('../core-dist/index.js');
  assert.doesNotThrow(() => assertWorkspaceAccess({ userId:'u1', workspaceId:'w1', role:'USER' }, 'w1'));
  assert.throws(() => assertWorkspaceAccess({ userId:'u1', workspaceId:'w1', role:'USER' }, 'w2'), /WORKSPACE_ACCESS_DENIED/);
});

test('credential encryption round-trips without plaintext storage', async () => {
  const { importCredentialKey, encryptCredential, decryptCredential, maskCredential } = require('../core-dist/index.js');
  const keyBytes = new Uint8Array(32); crypto.getRandomValues(keyBytes);
  let binary=''; for (const b of keyBytes) binary += String.fromCharCode(b);
  const key = await importCredentialKey(btoa(binary));
  const encrypted = await encryptCredential('secret-provider-key-1234', key);
  assert.notEqual(encrypted.ciphertext, 'secret-provider-key-1234');
  assert.equal(await decryptCredential(encrypted, key), 'secret-provider-key-1234');
  assert.equal(maskCredential('secret-provider-key-1234').endsWith('1234'), true);
});
