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

const { isDemoWorkspace } = await importSource('../apps/web/lib/demo-mode.ts');

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
