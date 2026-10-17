import Link from 'next/link';
import { requireUserPage } from '../../../lib/auth';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function calendarDays(now: Date, length: number) {
  return Array.from({ length }, (_, i) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (length - i - 1)));
    return { date, key: date.toISOString().slice(0, 10), label: date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) };
  });
}

export default async function DashboardPage() {
  const auth = await requireUserPage();
  const workspaceId = auth.workspace?.id;
  const days = calendarDays(new Date(), 14);
  const since = days[0].date;
  const [stores, products, drafts, publishedListings, assets, notifications, recentProducts, connectors, orders, openOrders, stockBalances, recentOrders] = await Promise.all([
    workspaceId ? db.storeConnector.count({ where: { workspaceId } }) : 0,
    workspaceId ? db.product.count({ where: { workspaceId } }) : 0,
    workspaceId ? db.product.count({ where: { workspaceId, status: 'DRAFT' } }) : 0,
    workspaceId ? db.marketplaceListing.count({ where: { product: { workspaceId }, syncStatus: 'SYNCED' } }) : 0,
    workspaceId ? db.asset.count({ where: { workspaceId } }) : 0,
    db.notification.count({ where: { userId: auth.user.id, readAt: null } }),
    workspaceId ? db.product.findMany({ where: { workspaceId, createdAt: { gte: since } }, select: { createdAt: true }, take: 10000 }) : [],
    workspaceId ? db.storeConnector.findMany({ where: { workspaceId }, orderBy: { updatedAt: 'desc' }, take: 5,
      select: { id: true, name: true, provider: true, mode: true, enabled: true, lastSyncAt: true, lastValidatedAt: true, lastErrorCode: true } }) : [],
    workspaceId ? db.commerceOrder.count({where:{workspaceId}}) : 0,
    workspaceId ? db.commerceOrder.count({where:{workspaceId,status:{in:['NEW','CONFIRMED','PACKING']}}}) : 0,
    workspaceId ? db.stockBalance.aggregate({where:{workspaceId},_sum:{quantity:true},_count:{id:true}}) : null,
    workspaceId ? db.commerceOrder.findMany({where:{workspaceId},take:6,orderBy:{createdAt:'desc'},select:{id:true,orderNumber:true,status:true,source:true,createdAt:true,totalMinor:true,currency:true}}) : [],
  ]);
  const counts = new Map(days.map(day => [day.key, 0]));
  for (const product of recentProducts) {
    const key = product.createdAt.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...counts.values());
  const metrics = [
    { title: 'Tanımlı mağazalar', value: stores, href: '/commerce/stores', note: 'Mağaza bağlantıları' },
    { title: 'Ürün kayıtları', value: products, href: '/commerce/products', note: 'Merkezi ürün kataloğu' },
    { title: 'Sipariş kayıtları', value: orders, href: '/commerce/orders', note: openOrders+' işlem bekliyor' },
    { title: 'Toplam stok', value: stockBalances?._sum.quantity ?? 0, href: '/commerce/inventory', note: (stockBalances?._count.id ?? 0)+' stok kalemi' },
  ];
  return <div className="content dashboard-home commerce-mobile">
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow">MAĞAZA OPERASYON MERKEZİ</span><h1 className="page-title">Genel Bakış</h1>
        <p className="page-subtitle">{auth.workspace?.name ?? 'Çalışma Alanı'} · Mağazalarınızın ve ürün verilerinizin güncel durumu</p></div>
      <Link className="action primary" href="/commerce/stores">Mağazaları yönet <span aria-hidden="true">↗</span></Link>
    </div>
    <section className="dashboard-hero">
      <div><span className="dashboard-hero-eyebrow">ENTEGREPILOT / TİCARET OPERASYONLARI</span>
        <h2>Operasyonlarınızın tamamı tek panelde.</h2>
        <p>Mağazalar, siparişler, ürünler ve depo kayıtları tek çalışma alanında. Görsel stüdyosu ve ürün araştırması Eklentiler bölümünde.</p>
        <div className="dashboard-hero-actions"><Link href="/commerce/orders" className="action primary">Siparişleri yönet</Link><Link href="/commerce/products" className="action">Ürün kataloğu</Link><Link href="/commerce/stores" className="action">Mağazalar</Link></div>
      </div>
      <div className="dashboard-hero-summary" aria-label="Platform veri özeti">
        <span>OPERASYON ÖZETİ</span><strong>{openOrders.toLocaleString('tr-TR')}</strong><small>işlem bekleyen sipariş</small>
        <div className="dashboard-hero-detail"><span>{stores} mağaza</span><span>{products} ürün</span><span>{assets} dosya</span><span>{notifications} bildirim</span></div>
      </div>
    </section>
    <section className="dashboard-stat-grid" aria-label="Mağaza göstergeleri">
      {metrics.map((item, index) => <Link className="dashboard-stat card" href={item.href} key={item.title}>
        <div className="dashboard-stat-caption"><span>{item.title}</span><span className="dashboard-stat-index">{String(index + 1).padStart(2,'0')}</span></div>
        <strong>{item.value.toLocaleString('tr-TR')}</strong><small>{item.note} <span aria-hidden="true">↗</span></small>
      </Link>)}
    </section>
    <div className="dashboard-analytics-grid">
      <section className="card dashboard-analytics-card">
        <div className="dashboard-section-heading"><div><h2>Ürün hareketleri</h2><p>Son 14 günde oluşturulan ürün kayıtları</p></div><span className="badge">14 Gün</span></div>
        <div className="dashboard-bar-chart" role="img" aria-label={days.map(day=>`${day.label}: ${counts.get(day.key) ?? 0} ürün`).join(', ')}>
          {days.map(day=><div className="dashboard-bar-column" key={day.key} title={`${day.label}: ${counts.get(day.key) ?? 0} ürün`}>
            <span className="dashboard-bar" style={{height:`${Math.max(3, ((counts.get(day.key) ?? 0) / maxCount) * 100)}%`}} />
            <small>{day.date.getUTCDate()}</small>
          </div>)}
        </div>
        <p className="dashboard-chart-caption">Bu grafik yalnızca sistemde kayıtlı gerçek ürünleri gösterir; dış pazaryeri satış verisi içermez.</p>
      </section>
      <section className="card dashboard-connectors-card">
        <div className="dashboard-section-heading"><div><h2>Mağaza bağlantıları</h2><p>Güncel entegrasyon durumu</p></div><Link href="/commerce/stores">Tümünü gör →</Link></div>
        {connectors.length ? <div className="dashboard-connector-list">{connectors.map(c=>
          <div className="dashboard-connector-row" key={c.id}>
            <span className="dashboard-connector-icon" aria-hidden="true">{c.provider.slice(0,1).toUpperCase()}</span>
            <div><strong>{c.name}</strong><small>{c.provider} · {c.mode==='PRODUCTION'?'Canlı API ortamı':'Test ortamı'}</small></div>
            <span className={`badge ${c.enabled&&c.lastValidatedAt&&!c.lastErrorCode?'active':''}`}>{c.lastErrorCode?'Bağlantı hatası':!c.enabled?'Kayıt pasif':c.lastValidatedAt?'Kimlik doğrulandı':'Doğrulanmadı'}</span>
          </div>)}</div>
          : <div className="dashboard-no-stores"><strong>Bağlı mağaza bulunmuyor</strong><p>Bağlantı işlemleri doğrulanmadan canlı veri görüntülenmez.</p><Link href="/commerce/stores" className="action">Bağlantıları görüntüle</Link></div>}
      </section>
    </div>
    <section className="card dashboard-orders-card" aria-label="Son siparişler">
      <div className="dashboard-section-heading"><div><h2>Son siparişler</h2><p>Çalışma alanınızdaki en yeni 6 kayıt</p></div><Link href="/commerce/orders">Siparişlere git →</Link></div>
      {recentOrders.length ? <div className="store-table-wrap"><table className="store-table">
        <thead><tr><th>Sipariş no</th><th>Kaynak</th><th>Durum</th><th>Tutar</th><th>Tarih</th></tr></thead>
        <tbody>{recentOrders.map(order=><tr key={order.id}>
          <td data-label="Sipariş no"><strong>{order.orderNumber}</strong></td><td data-label="Kaynak">{order.source === 'MANUAL' ? 'Manuel' : order.source}</td>
          <td data-label="Durum"><span className={order.status === 'DELIVERED' ? 'badge active' : 'badge'}>{({NEW:'Yeni',CONFIRMED:'Onaylandı',PACKING:'Hazırlanıyor',SHIPPED:'Kargolandı',DELIVERED:'Teslim edildi',CANCELLED:'İptal'} as Record<string,string>)[order.status] ?? order.status}</span></td>
          <td data-label="Tutar">{(order.totalMinor/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} {order.currency}</td>
          <td data-label="Tarih">{order.createdAt.toLocaleDateString('tr-TR')}</td>
        </tr>)}</tbody></table></div> : <div className="dashboard-empty-state"><strong>Henüz sipariş kaydı yok</strong><p>Manuel siparişler ve ileride doğrulanacak pazaryeri siparişleri burada görünecek.</p><Link href="/commerce/orders" className="action">Sipariş ekranını aç</Link></div>}
    </section>
    <div className="dashboard-section-heading"><div><h2>Yönetim araçları</h2><p>Öncelikli ticaret modülleri ve ek araçlar</p></div><Link href="/billing">Paket ve kredilerim →</Link></div>
    <section className="dashboard-module-grid" aria-label="Platform modülleri">{[
      {title:'Mağaza Entegrasyonları',description:'Bağlantıları ve eşlemeleri takip edin.',href:'/commerce/stores',tag:'ANA MODÜL'},
      {title:'Sipariş Yönetimi',description:'Siparişleri, durumları ve işlem geçmişini yönetin.',href:'/commerce/orders',tag:'OPERASYON'},
      {title:'Ürün ve Stok',description:'Ürün kataloğu, barkod ve depo stok kayıtları.',href:'/commerce/inventory',tag:'ANA MODÜL'},
      {title:'Veri Yönetimi',description:'İçe/dışa aktarma araçlarına erişin.',href:'/commerce/import-export',tag:'OPERASYON'},
      {title:'Eklentiler',description:'Görsel stüdyosu ve ürün araştırması.',href:'/create/design-studio',tag:'YARDIMCI ARAÇ'},
    ].map(module => <Link className="card dashboard-module" href={module.href} key={module.href}><span className="dashboard-module-tag">{module.tag}</span><h3>{module.title}</h3><p>{module.description}</p><span className="dashboard-module-action">Modülü aç →</span></Link>)}</section>
  </div>;
}
