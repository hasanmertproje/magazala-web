import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importSource(path) {
  const input = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
}

const { isDemoWorkspace, assertDemoExternalOperationAllowed } = await importSource('../apps/web/lib/demo-mode.ts');

test('demo tenant is identified by isolated workspace identity', () => {
  assert.equal(isDemoWorkspace({ slug: 'entegrepilot-demo' }), true);
  assert.equal(isDemoWorkspace({ slug: 'regular-customer' }), false);
  assert.equal(isDemoWorkspace(null), false);
});

test('demo cannot configure or validate real marketplace credentials', async () => {
  const creation = await readFile(new URL('../apps/web/app/api/commerce/stores/route.ts', import.meta.url), 'utf8');
  const validation = await readFile(new URL('../apps/web/app/api/commerce/stores/[id]/test/route.ts', import.meta.url), 'utf8');
  const denied = /if \(isDemoWorkspace\(auth\.context\.workspace\)\)\s*return NextResponse\.json\(\{ ok: false, code: 'DEMO_EXTERNAL_CONNECTOR_DISABLED' \}, \{ status: 403 \}\)/;
  assert.match(creation, denied);
  assert.match(validation, denied);
  assert.ok(creation.indexOf("if (isDemoWorkspace(auth.context.workspace))") < creation.indexOf('encryptTrendyolCredentials(input)'));
  assert.ok(validation.indexOf("if (isDemoWorkspace(auth.context.workspace))") < validation.indexOf('validateTrendyolConnection(credentials)'));
});

test('demo provider guard rejects demo and permits ordinary workspaces', () => {
  assert.throws(() => assertDemoExternalOperationAllowed({ slug: 'entegrepilot-demo' }),
    /DEMO_EXTERNAL_OPERATION_DISABLED/);
  assert.doesNotThrow(() => assertDemoExternalOperationAllowed({ slug: 'regular-customer' }));
  assert.doesNotThrow(() => assertDemoExternalOperationAllowed(null));
});

test('all external AI and research HTTP routes use fail-closed demo authorization', async () => {
  const routes = [
    '../apps/web/app/api/design/generate/route.ts',
    '../apps/web/app/api/product-intelligence/idea/route.ts',
    '../apps/web/app/api/product-intelligence/research/route.ts',
    '../apps/web/app/api/discovery/conversations/[id]/messages/route.ts',
    '../apps/web/app/api/discovery/conversations/[id]/analyze/route.ts',
  ];
  for (const path of routes) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /requireExternalProviderApi/);
    assert.doesNotMatch(source, /requireUserApi/);
  }
  const auth = await readFile(new URL('../apps/web/lib/auth.ts', import.meta.url), 'utf8');
  assert.match(auth, /if \(isDemoWorkspace\(auth\.context\.workspace\)\)/);
  assert.match(auth, /DEMO_EXTERNAL_OPERATION_DISABLED/);
});

test('direct text and image providers enforce demo isolation before provider lookup', async () => {
  const textSource = await readFile(new URL('../apps/web/lib/ai-text.ts', import.meta.url), 'utf8');
  const imageSource = await readFile(new URL('../apps/web/lib/image-generation.ts', import.meta.url), 'utf8');
  const textFunction = textSource.slice(textSource.indexOf('export async function generateProviderBackedText'));
  const imageFunction = imageSource.slice(imageSource.indexOf('export async function generateAndStoreImage'));
  for (const source of [textFunction, imageFunction]) {
    assert.match(source, /db\.workspace\.findUnique/);
    assert.match(source, /assertDemoExternalOperationAllowed\(workspace\)/);
  }
  assert.ok(textFunction.indexOf('assertDemoExternalOperationAllowed(workspace)') <
    textFunction.indexOf('loadCandidates()'));
  assert.ok(imageFunction.indexOf('assertDemoExternalOperationAllowed(workspace)') <
    imageFunction.indexOf('loadImageModels(requiredCapability)'));
});
