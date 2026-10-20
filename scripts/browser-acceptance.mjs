import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

if (process.env.CI !== 'true') throw new Error('BROWSER_ACCEPTANCE_IS_CI_ONLY');
const base = process.env.APP_URL || 'http://localhost:3000';
const widths = [320, 375, 390, 430, 768, 1024, 1440];
const routes = ['/dashboard', '/commerce/orders', '/commerce/inventory', '/admin/workspaces'];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const out = 'test-artifacts/screenshots';
await mkdir(out, { recursive: true });

async function login(page, email, password) {
  await page.goto(base + '/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await Promise.all([
    page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 20000 }),
    page.getByRole('button', { name: 'Giriş yap' }).click(),
  ]);
}

async function assertPanel(page, panel) {
  const shell = page.locator('.shell[data-panel="' + panel + '"]');
  await shell.waitFor({ state: 'visible' });
  const links = await shell.locator('aside nav a[href]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('href')));
  assert.ok(links.length > 2, panel + ' navigation should not be empty');
  assert.ok(links.every((href) => panel === 'admin' ?
    href.startsWith('/admin/') : !href.startsWith('/admin/')),
    panel + ' leaked routes: ' + links.join(', '));
}

async function auditOverflow(page, route, width) {
  const audit = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const viewport = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll('body *')).filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      if (style.position === 'fixed' || style.visibility === 'hidden') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.right > viewport + 2;
    }).slice(0, 7).map((el) => ({
      selector: el.tagName.toLowerCase() + '.' + String(el.className).split(' ').join('.'),
      right: Math.round(el.getBoundingClientRect().right),
    }));
    return { docWidth, viewport, offenders };
  });
  assert.ok(audit.docWidth <= audit.viewport + 2,
    'Horizontal overflow: ' + route + ' at ' + width + 'px: ' + JSON.stringify(audit));
}

async function mobileDrawer(page, route, width) {
  const menu = page.locator('.mobile-menu-toggle');
  assert.ok(await menu.isVisible(), 'mobile menu hidden: ' + route + '/' + width);
  await menu.click();
  const drawer = page.locator('aside.sidebar-open');
  await drawer.waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('sidebar-close')), true);
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('mobile-menu-toggle')), true);
  await menu.click();
  // The overlay begins behind the drawer; click the visible strip beside it.
  const box = await page.locator('aside.sidebar-open').boundingBox();
  assert.ok(box);
  await page.mouse.click(width - 5, Math.min(180, box.height / 2));
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
}

let context;
try {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, 'ci-runtime@example.com', 'CiRuntimePassword123!');
  await assertPanel(page, 'workspace');
  const visibleOrder = await page.locator('body').innerText();
  assert.ok(visibleOrder.includes('CI-E2E-VISIBLE-ORDER'), 'workspace order not found on dashboard');
  assert.ok(!visibleOrder.includes('CI-E2E-HIDDEN-ORDER'), 'cross-tenant order leaked on dashboard');

  await page.goto(base + '/admin/workspaces');
  await assertPanel(page, 'admin');
  await page.locator('aside a.panel-switch-link[href="/dashboard"]').click();
  await assertPanel(page, 'workspace');
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await assertPanel(page, 'admin');
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await assertPanel(page, 'workspace');

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      await assertPanel(page, route.startsWith('/admin/') ? 'admin' : 'workspace');
      await auditOverflow(page, route, width);
      await page.screenshot({
        path: out + '/' + route.replaceAll('/', '_').replace(/^_/, '') + '-' + width + '.png',
        fullPage: true,
        animations: 'disabled',
      });
      if (width <= 768) await mobileDrawer(page, route, width);
    }
  }
  await context.close();

  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const regular = await context.newPage();
  await login(regular, 'ci-workspace@example.invalid', 'CiWorkspacePassword123!');
  await assertPanel(regular, 'workspace');
  assert.equal(await regular.locator('aside a.panel-switch-link[href="/admin/workspaces"]').count(), 0,
    'non-admin got admin panel transition');
  await regular.goto(base + '/admin/workspaces', { waitUntil: 'domcontentloaded' });
  await regular.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 20000 });
  await assertPanel(regular, 'workspace');
  const forbidden = await context.request.get(base + '/api/admin/models');
  assert.equal(forbidden.status(), 403, 'non-admin must be forbidden by API');
  console.log('Browser acceptance PASSED: 7 viewports, 4 routes, two roles, full page navigation, back/forward, mobile focus/scroll, tenant isolation.');
} finally {
  await context?.close().catch(() => {});
  await browser.close();
}
