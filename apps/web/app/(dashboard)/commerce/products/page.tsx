import { requireUserPage } from '../../../../lib/auth';
import { assertFeatureEnabled } from '../../../../lib/entitlements';
import { db } from '../../../../lib/db';
import { clampPage, parsePage } from '../../../../lib/order-filters';
import { commercePageUrl, parseCommerceSearch, parseProductStatus, productSearchCondition } from '../../../../lib/commerce-search';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;
const labels: Record<string, string> = { DRAFT:'Taslak', ACTIVE:'Aktif', ARCHIVED:'Arşivlendi' };

export default async function ProductsPage({ searchParams }: {
  searchParams: Promise<{ notice?: string; error?: string; q?: string; status?: string; page?: string }>;
}) {
  const auth = await requireUserPage();
  if (!auth.workspace) return <div className="content"><h1 className="page-title">Çalışma alanı bulunamadı</h1></div>;
  const params = await searchParams;
  const search = parseCommerceSearch(params.q);
  const status = parseProductStatus(params.status);
  const workspaceId = auth.workspace.id;
  let available = true;
  try { await assertFeatureEnabled(workspaceId, auth.user.isSuperAdmin, 'commerce.products'); }
  catch { available = false; }

  const where = { workspaceId, ...productSearchCondition(search), ...(status ? {status} : {}) };
  const [filteredTotal, total] = available ? await Promise.all([
    db.product.count({ where }), db.product.count({ where: { workspaceId } }),
  ]) : [0, 0];
  const page = clampPage(parsePage(params.page), filteredTotal, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const products = available ? await db.product.findMany({
    where, orderBy: [{ updatedAt:'desc' }, { id:'desc' }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: { id:true, name:true, internalSku:true, internalBarcode:true, status:true,
      price:true, currency:true, updatedAt:true },
  }) : [];
  const pageLink = (n: number) => commercePageUrl('/commerce/products',n,{q:search,status});
  const start = filteredTotal ? (page-1)*PAGE_SIZE+1 : 0;
  const end = Math.min(filteredTotal,page*PAGE_SIZE);

  return <div className="content commerce-mobile commerce-operations-page">
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow">MAĞAZA YÖNETİMİ / KATALOG</span>
        <h1 className="page-title" style={{ marginTop:12 }}>Ürün Kataloğu</h1>
        <p className="page-subtitle">SKU ve barkod bazlı iç ürün kayıtları. Pazaryeri yayınlama ve senkronizasyon henüz etkin değildir.</p>
      </div>
      <a className="action primary" href="#new-product">Yeni ürün kaydı</a>
    </div>
    {params.notice ? <p role="status" className="card">Ürün kaydı oluşturuldu.</p> : null}
    {params.error ? <p role="alert" className="card" style={{color:'var(--danger)'}}>İşlem tamamlanamadı: {params.error}</p> : null}
    {!available ? <section className="card">Bu çalışma alanının paketinde ürün kataloğu kullanım yetkisi bulunmuyor.</section> : <>
      <section className="card commerce-records" aria-label="Ürün listesi">
        <div className="dashboard-section-heading">
          <div><h2>Ürün kayıtları</h2><p>{total.toLocaleString('tr-TR')} toplam · {filteredTotal.toLocaleString('tr-TR')} eşleşen · {start}–{end} gösteriliyor</p></div>
          <span className="badge">Sayfa {page}/{pages}</span>
        </div>
        <form method="get" action="/commerce/products" className="commerce-query-form" role="search">
          <label htmlFor="product-search">Ad, SKU veya barkod
            <input id="product-search" className="input" name="q" type="search" maxLength={80}
              defaultValue={search} autoComplete="off" placeholder="Ürün veya barkod ara"/>
          </label>
          <label htmlFor="product-status">Kayıt durumu
            <select id="product-status" className="input" name="status" defaultValue={status??''}>
              <option value="">Tüm kayıtlar</option><option value="DRAFT">Taslak</option><option value="ACTIVE">Aktif</option>
            </select>
          </label>
          <button type="submit" className="action primary">Kayıtları bul</button>
          {(search||status) ? <a className="action" href="/commerce/products">Temizle</a> : null}
        </form>
        {products.length ? <div className="store-table-wrap"><table className="store-table">
          <thead><tr><th>Ürün</th><th>SKU</th><th>Barkod</th><th>Durum</th><th>Fiyat</th><th>Güncelleme</th></tr></thead>
          <tbody>{products.map(product => <tr key={product.id}>
            <td data-label="Ürün"><strong>{product.name}</strong></td>
            <td data-label="SKU">{product.internalSku ?? '—'}</td>
            <td data-label="Barkod">{product.internalBarcode ?? '—'}</td>
            <td data-label="Durum"><span className="badge">{labels[product.status] ?? product.status}</span></td>
            <td data-label="Fiyat">{product.price != null ? product.price.toString()+' '+(product.currency??'TRY') : '—'}</td>
            <td data-label="Güncelleme">{product.updatedAt.toLocaleDateString('tr-TR')}</td>
          </tr>)}</tbody>
        </table></div> : <div className="dashboard-empty-state"><strong>{search||status?'Bu ölçütlerde ürün bulunamadı':'Henüz ürün kaydı bulunmuyor'}</strong>
          <p>{search||status?'Aramayı değiştirebilir veya filtreyi temizleyebilirsiniz.':'Yeni ürün kaydı oluşturmak için aşağıdaki formu açın.'}</p>
        </div>}
        <nav className="commerce-pagination" aria-label="Ürün sayfaları">
          <span>{filteredTotal.toLocaleString('tr-TR')} eşleşme · Sayfa {page}/{pages}</span>
          {page > 1 ? <a className="action" href={pageLink(page-1)}>← Önceki</a> : null}
          {page < pages ? <a className="action" href={pageLink(page+1)}>Sonraki →</a> : null}
        </nav>
      </section>
      <details id="new-product" className="card commerce-disclosure">
        <summary><span><strong>Yeni taslak ürün oluştur</strong><small>Kaydetmeden önce ad, SKU ve fiyat bilgilerini girin</small></span><span aria-hidden="true">+</span></summary>
        <form action="/api/commerce/products" method="post" className="commerce-product-form">
          <label>Ürün adı<input className="input" name="name" required minLength={2} maxLength={180}/></label>
          <label>SKU<input className="input" name="internalSku" maxLength={80}/></label>
          <label>Barkod<input className="input" name="internalBarcode" maxLength={80}/></label>
          <label>Fiyat<input className="input" name="price" type="number" min="0" step="0.01"/></label>
          <label>Para birimi<select className="input" name="currency" defaultValue="TRY"><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
          <label className="commerce-product-description">Açıklama<textarea className="input" name="description" rows={2} maxLength={5000}/></label>
          <button type="submit" className="action primary">Taslak ürünü kaydet</button>
        </form>
      </details>
    </>}
  </div>;
}
