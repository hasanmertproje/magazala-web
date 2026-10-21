import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

if (process.env.CI !== 'true') throw new Error('BROWSER_ACCEPTANCE_IS_CI_ONLY');
const base = process.env.APP_URL || 'http://localhost:3000';
const widths = [320, 360, 375, 390, 430, 768, 1024, 1440];
const routes = ['/dashboard', '/commerce/orders', '/commerce/products', '/commerce/inventory', '/commerce/stores', '/admin/workspaces'];
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
  const iconCount=await shell.locator('aside nav a .nav-icon svg').count();
  assert.equal(iconCount,links.length,panel+' navigation icons must render for every link');
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

  // Dashboard priority links must resolve to the corresponding real filtered records.
  await page.goto(base + '/dashboard');
  const lowLink=page.locator('.v3-priority[href="/commerce/inventory?filter=LOW"]');
  assert.equal(await lowLink.count(),1);
  const openLink=page.locator('.v3-priority[href="/commerce/orders?status=OPEN"]');
  assert.equal(await openLink.count(),1);
  await openLink.click();
  assert.equal(await page.locator('#order-status-filter').inputValue(),'OPEN');
  let list=await page.locator('.store-table tbody').first().innerText();
  assert.ok(list.includes('CI-E2E-VISIBLE-ORDER'));
  assert.ok(!list.includes('CI-E2E-OLD-001'), 'closed orders entered the OPEN filter');

  const filtered=await context.request.get(base+'/api/commerce/orders?status=OPEN');
  assert.equal(filtered.status(),200);
  const filteredData=await filtered.json();
  assert.equal(filteredData.pagination.total,1);
  assert.equal(filteredData.orders[0].orderNumber,'CI-E2E-VISIBLE-ORDER');

  await page.goto(base+'/commerce/orders');
  assert.equal(await page.locator('a[href="/commerce/orders?page=2"]').count(),1,
    'historical orders lack next-page navigation');
  await page.locator('a[href="/commerce/orders?page=2"]').click();
  list=await page.locator('.store-table tbody').first().innerText();
  assert.ok(list.includes('CI-E2E-OLD-'), 'older orders inaccessible on page 2');
  assert.equal(await page.locator('a[href="/commerce/orders"]').count()>0,true);

  // Search both SSR and JSON API with the same exact tenant boundary and page semantics.
  await page.goto(base+'/commerce/orders?q=CI-E2E-VISIBLE&status=OPEN');
  assert.equal(await page.locator('#order-search').inputValue(),'CI-E2E-VISIBLE');
  assert.equal(await page.locator('#order-status-filter').inputValue(),'OPEN');
  list=await page.locator('.store-table tbody').first().innerText();
  assert.ok(list.includes('CI-E2E-VISIBLE-ORDER'));
  assert.ok(!list.includes('CI-E2E-HIDDEN-ORDER'));
  const searchOrders=await context.request.get(base+'/api/commerce/orders?q=CI-E2E-VISIBLE&status=OPEN');
  assert.equal(searchOrders.status(),200);
  assert.equal((await searchOrders.json()).pagination.total,1);

  // Operational dashboard barcode/SKU shortcut routes to actual catalog search.
  await page.goto(base+'/dashboard');
  await page.locator('#dashboard-sku-lookup').fill('CI-E2E-CATALOG-055');
  await page.getByRole('button',{name:/Katalogda bul/}).click();
  await page.waitForURL(/\/commerce\/products\?q=CI-E2E-CATALOG-055/);
  assert.ok((await page.locator('.store-table tbody').innerText()).includes('CI Katalog Ürünü 055'));

  await page.goto(base+'/commerce/products?q=CI-E2E-CATALOG-055');
  assert.equal(await page.locator('#product-search').inputValue(),'CI-E2E-CATALOG-055');
  const productRows=await page.locator('.store-table tbody').innerText();
  assert.ok(productRows.includes('CI Katalog Ürünü 055'));
  assert.ok(!productRows.includes('CI Gizli Ürün'));
  const searchProducts=await context.request.get(base+'/api/commerce/products?q=CI-E2E-CATALOG-055');
  assert.equal(searchProducts.status(),200);
  const productData=await searchProducts.json();
  assert.equal(productData.pagination.total,1);
  assert.equal(productData.products[0].internalSku,'CI-E2E-CATALOG-055');
  await page.goto(base+'/commerce/products');
  assert.equal(await page.locator('a[href="/commerce/products?page=2"]').count(),1);
  await page.locator('a[href="/commerce/products?page=2"]').click();
  assert.ok((await page.locator('.store-table tbody').innerText()).includes('CI Katalog Ürünü'));
  await page.goto(base+'/commerce/products?create=1#new-product');
  assert.ok(await page.locator('#new-product').evaluate(node=>node.open),
    'new product action must expand an actual working form');
  assert.ok(await page.locator('#new-product input[name="name"]').isVisible());

  // A product beyond the former 500-result dropdown cap can be selected by SKU.
  await page.goto(base+'/commerce/inventory');
  const lookup=page.getByRole('combobox',{name:'Ürün ara ve seç'});
  await lookup.fill('CI-E2E-CATALOG-505');
  await page.getByRole('option',{name:/CI Katalog Ürünü 505/}).click();
  assert.notEqual(await page.locator('input[name="productId"]').inputValue(),'');
  assert.ok((await page.locator('.inventory-product-selected').innerText()).includes('CI Katalog Ürünü 505'));
  await page.getByRole('button',{name:'Değiştir'}).click();
  assert.equal(await page.locator('input[name="productId"]').inputValue(),'');

  // Connector status is explicitly simulated; full workspace list remains pageable.
  await page.goto(base+'/commerce/stores?q=CI-STORE-MOCK-034&status=MOCK');
  assert.equal(await page.locator('#connector-search').inputValue(),'CI-STORE-MOCK-034');
  assert.equal(await page.locator('#connector-filter').inputValue(),'MOCK');
  assert.ok((await page.locator('.store-table tbody').innerText()).includes('CI-STORE-MOCK-034'));
  assert.equal(await page.locator('.store-table tbody .connection-simulated').count(),1);
  await page.goto(base+'/commerce/stores');
  assert.equal(await page.locator('a[href="/commerce/stores?page=2"]').count(),1);
  await page.locator('a[href="/commerce/stores?page=2"]').click();
  assert.ok((await page.locator('.store-table tbody').innerText()).includes('CI-STORE-MOCK-'));

  await page.goto(base+'/dashboard');
  await page.locator('.v3-priority[href="/commerce/inventory?filter=LOW"]').click();
  assert.equal(await page.locator('#inventory-filter').inputValue(),'LOW');
  const lowRows=await page.locator('.store-table tbody').first().innerText();
  assert.ok(lowRows.includes('CI E2E Düşük Stok'));
  assert.ok(!lowRows.includes('CI E2E Sağlıklı Stok'));

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      await assertPanel(page, route.startsWith('/admin/') ? 'admin' : 'workspace');
      await auditOverflow(page, route, width);
      if (route==='/dashboard' && width<=640) {
        const gridColumns=await page.locator('.dashboard-module-grid').evaluate((node)=>
          getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
        assert.equal(gridColumns,2,'mobile secondary tools must use a compact native grid');
      }
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
  console.log('Browser acceptance PASSED: 8 viewports, 6 routes, two roles, full page navigation, back/forward, mobile focus/scroll, tenant isolation.');
} finally {
  await context?.close().catch(() => {});
  await browser.close();
}
