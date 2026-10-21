# EntegrePilot — Commerce UI/UX audit and focused remediation (2026-10-21)

## Verified baseline
- Production main before change: db5c331fb52560032c99e8b0b2e504e9a18a2d48; PR #37–#44 merged and Railway SUCCESS.
- UI: Next.js 16/React 19, server-rendered App Router pages, app-specific globals.css design vocabulary, bespoke DashboardIcon and route-specific SVGs. No separate MUI, Bootstrap, chart or table runtime library in apps/web/package.json.
- Browser CI exercises real auth, shell isolation and seven widths: 320/375/390/430/768/1024/1440.
- **Current risks:** repeated :root CSS token overrides, display-dense KPI containers outside Dashboard V3, historic product listings silently clipped at 100 rows, orders lack lookup by number/reference, inventory stock correction product dropdown clipped at 500 rows, integrated marketplace sync not live.

## Reference and license decision
| Reference | Assessment |
| --- | --- |
| Vuexy MUI Next.js | Paid and license-tiered; visual/functional inspiration only. Do not copy or bundle. |
| Materio MUI Next.js Free | Repository MIT licensed, but documentation requests attribution. MUI/Tailwind would duplicate current styling and increase migration risk; no code adopted. |
| OrbynAdmin | MIT licensed Next.js example; includes 70+ demo-only screens, shallow commit history. IA inspiration only, no import. |
| Tabler | MIT framework; Bootstrap and bundled third-party dependencies need separate compliance. ApexCharts v5 has a separate dual-license. Do not add runtime. |
| TanStack Table | MIT headless tables; not needed for the current 50-row SSR pages. Re-evaluate if column virtualization or client interactivity proves necessary. |
| Modular Studio | Exact referenced asset and applicable license not verified; no code imported or claims made. |

## Shipped in this PR
1. **Catalog recovery:** searchable SKU/barcode/name, draft/active filtering, deterministic 50-row server pagination and real totals; same rules in JSON API with backward-compatible 100/page.
2. **Order handling:** direct OPEN/NEW/PACKING/SHIPPED filters, search by internal order no/customer reference with API parity and shareable URL filters.
3. **Mobile task hierarchy:** searchable lists and distinct quick filters precede secondary catalog creation; native disclosure removes large distracting data-entry form until needed; dedicated compact query/filter controls and table field labels.
4. **Regression coverage:** bounded input, query predicates, deep-link navigation and consistent API/page scope. Server-side search remains scoped to authenticated workspace.

## Remaining work and acceptance constraints
- Inventory correction dropdown fixed 500 product limit needs a scalable SKU-first picker/server-backed search.
- True product variant / marketplace mappings, provider sync, returns and payments are not implemented; do not fabricate.
- Existing CSS contains redundant historical overrides; remove only with browser screenshot diff evidence.
- Accessibility, visual quality, real device touch, browser performance and production smoke require real Chromium verification, not only static tests.
- No migration, external service, dependency, irreversible write or customer data alteration in this PR.

## M5 follow-up: Inventory SKU-first product selection
The inventory adjustment form formerly materialized only the first 500 products in an unrestricted dropdown. It now queries the existing authenticated, workspace-scoped product API by name/SKU/barcode, requiring explicit selection with a stable internal product ID. Client lookups are debounced and abortable; keyboard ArrowUp/ArrowDown/Enter/Escape and ARIA combobox/listbox semantics are included. No direct stock write occurs on selection; only the existing privileged server-side adjustment endpoint commits stock changes with its existing idempotency key.

At narrow widths, actual stock balances are shown before creation/adjustment forms, with a direct LOW-stock drilldown from the page heading. Tests exercise a CI-only real product selection. Remaining: real device/IME screen-reader review, server load measurement at six-figure catalogs, and deeper query index analysis.

## M6/M8 dashboard: actionable lookup, cohesion and query efficiency

- Dashboard V3's operations hero gains a real SKU/barcode/product lookup that deep-links to tenant-scoped searchable catalog records; it never simulates a scan or submits an external marketplace action.
- Four floating metrics are rendered as one continuous instrument strip, with partition lines, keyboard focus and 2-column mobile reflow. This is scoped to `.dashboard-v3` and leaves admin and internal commerce metrics untouched.
- The former 14 independent per-day `Product.count()` calls become **one** PostgreSQL Istanbul-day aggregate, with a tenant boundary and the same day semantics as the existing order chart; a CI integration transaction verifies timezone grouping and cross-tenant exclusion.
- Required acceptance: full Next production build, query integration tests, eight-viewport Chromium overflow and dashboard lookup navigation. Only post-test claims are valid; human visual and touch audit still pending.

## M5 integration UX: honest connector status and bounded listing
- Connector record table is now 30/page, ordered deterministically. Filter by credential status (mock/error/verified/unverified) and name/provider; server-side tenant-scoped search. True counts are independent of the current page.
- Header distinguishes **credential verification** from real marketplace data sync. MOCK records can never be labeled verified, and no fake retry/synchronization action exists. The only active existing action is credential verification for Trendyol, with role-based access.
- Mobile field-labelled records and filter strips reuse established EntegrePilot components rather than importing a paid template. Creation is behind a real native disclosure, openable by deep link.
- PostgreSQL test data creates 34 MOCK connections in CI only; Chromium verifies search and paginated access. Real provider sandbox integration, sync history storage and queue retries remain separate unimplemented work.

## Screenshot-driven M7 remediation: order worklist density
Human review of archived real Chromium screenshots showed 390px Orders ~15,452px tall with the manual intake form preceding the worklist; the Products page was ~13,481px tall due 50 mobile record cards. New changes place the actual order queue first, replace four oversized KPI cards (including a pseudo-metric 'Manual / Test') with a real-data compact strip and put manual creation into an accessible, deep-linkable native disclosure below the queue. SSR Orders pagination is 20/page, SSR Products 24/page, their JSON APIs keep the established 100/page default. Status transitions and source identifiers stay intact. Chromium verifies the creation disclosure on direct link; manual visual/touch acceptance remains an independent gate.

## Screenshot-driven connector density fix (390px)
The full-height Chromium screenshot of the 30-record mobile connector page was 11,287px. Reduce to 15 records/page without hiding credentials status, last sync, error explanation or actions; preserve server-side filters, stable order, tenant scoping and page navigation. Chromium acceptance asserts exactly 15 visible records for the disposable 34-connector fixture. This change does not claim human visual acceptance of every state.
