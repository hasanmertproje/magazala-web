import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
}

const { workspaceNavigationSections, adminNavigationSections, navigationForPanel } =
  await importSource('../apps/web/lib/panel-navigation.ts');

function hrefs(sections) {
  return sections.flatMap(([, links]) => links.map(([, href]) => href));
}

test('workspace sidebar never includes administration routes, even for a super admin', () => {
  assert.strictEqual(navigationForPanel('workspace'), workspaceNavigationSections);
  const links = hrefs(navigationForPanel('workspace'));
  assert.ok(links.includes('/dashboard'));
  assert.ok(links.includes('/commerce/orders'));
  assert.ok(links.every((href) => !/^\/admin(?:\/|$)/.test(href)), links.join(', '));
});

test('admin sidebar contains only administrator routes', () => {
  assert.strictEqual(navigationForPanel('admin'), adminNavigationSections);
  const links = hrefs(navigationForPanel('admin'));
  assert.ok(links.includes('/admin/workspaces'));
  assert.ok(links.every((href) => /^\/admin\//.test(href)), links.join(', '));
});

test('panel transitions require a document navigation rather than shared client navigation state', async () => {
  const appShell = await readFile(new URL('../apps/web/components/app-shell.tsx', import.meta.url), 'utf8');
  const adminShell = await readFile(new URL('../apps/web/components/admin-shell.tsx', import.meta.url), 'utf8');
  assert.match(appShell, /navigationForPanel\('workspace'\)/);
  assert.match(adminShell, /navigationForPanel\('admin'\)/);
  assert.match(appShell, /<a className="panel-switch-link" href="\/admin\/workspaces">/);
  assert.match(adminShell, /<a className="panel-switch-link" href="\/dashboard">/);
  assert.doesNotMatch(appShell, /\.\.\.adminNavigationSections|\.\.\.adminSections/);
});

test('admin server layout still requires superadmin authorization', async () => {
  const layout = await readFile(new URL('../apps/web/app/admin/layout.tsx', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../apps/web/lib/auth.ts', import.meta.url), 'utf8');
  assert.match(layout, /await requireSuperAdminPage\(\)/);
  assert.match(auth, /if \(!context\.user\.isSuperAdmin\) redirect\('\/'\)/);
  assert.match(auth, /if \(!context\.user\.isSuperAdmin\) return \{ ok: false as const, status: 403/);
});
