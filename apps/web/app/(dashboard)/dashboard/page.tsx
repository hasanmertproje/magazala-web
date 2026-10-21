import Link from 'next/link';
import { requireUserPage } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { DashboardIcon } from '../../../components/dashboard-icon';
import { DashboardRefresh } from '../../../components/dashboard-refresh';

export const dynamic = 'force-dynamic';

function calendarDays(now: Date, length: number) {
  // Reports use Istanbul calendar days, not server UTC midnight.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const today = Date.UTC(get('year'), get('month') - 1, get('day'));
  return Array.from({ length }, (_, i) => {
    const date = new Date(today - (length - i - 1) * 86400000);
    const key = date.toISOString().slice(0, 10);
    return { date: new Date(key + 'T00:00:00+03:00'), key,
      label: date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) };
  });
}

export default async function DashboardPage() {
  const auth = await requireUserPage();
  const workspaceId = auth.workspace?.id;
  const days = calendarDays(new Date(), 14);
  const [stores, products, notifications, dailyProductTotals, connectors, orders, openOrders, stockBalances, recentOrders, orderStatuses, warehouses, lowStockBalances, failedConnections, dailyOrders] = await Promise.all([
    workspaceId ? db.storeConnector.count({ where: { workspaceId } }) : 0,
    workspaceId ? db.product.count({ where: { workspaceId } }) : 0,
    db.notification.count({ where: { userId: auth.user.id, readAt: null } }),
    workspaceId ? db.$queryRaw<Array<{ day: string; count: number }>>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS "day",
             COUNT(*)::integer AS "count"
      FROM "Product"
      WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${days[0].date}
      GROUP BY 1 ORDER BY 1
    ` : [],
    workspaceId ? db.storeConnector.findMany({ where: { workspaceId }, orderBy: { updatedAt: 'desc' }, take: 5,
      select: { id: true, name: true, provider: true, mode: true, enabled: true, lastSyncAt: true, lastValidatedAt: true, lastErrorCode: true } }) : [],
    workspaceId ? db.commerceOrder.count({where:{workspaceId}}) : 0,
    workspaceId ? db.commerceOrder.count({where:{workspaceId,status:{in:['NEW','CONFIRMED','PACKING']}}}) : 0,
    workspaceId ? db.stockBalance.aggregate({where:{workspaceId},_sum:{quantity:true},_count:{id:true}}) : null,
    workspaceId ? db.commerceOrder.findMany({where:{workspaceId},take:6,orderBy:{createdAt:'desc'},select:{id:true,orderNumber:true,status:true,source:true,createdAt:true,totalMinor:true,currency:true}}) : [],
    workspaceId ? db.commerceOrder.groupBy({ by: ['status'], where: { workspaceId }, _count: { _all: true } }) : [],
    workspaceId ? db.warehouse.count({ where: { workspaceId } }) : 0,
    workspaceId ? db.stockBalance.count({ where: { workspaceId, quantity: { lte: 5 } } }) : 0,
    workspaceId ? db.storeConnector.count({ where: { workspaceId, lastErrorCode: { not: null } } }) : 0,
    workspaceId ? db.$queryRaw<Array<{ day: string; count: number }>>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD') AS "day",
             COUNT(*)::integer AS "count"
      FROM "CommerceOrder"
      WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${days[0].date}
      GROUP BY 1 ORDER BY 1
    ` : [],
  ]);
  const dailyProductMap = new Map(dailyProductTotals.map(row => [row.day, row.count]));
  const totalCreated = days.reduce((total, day) => total + (dailyProductMap.get(day.key) ?? 0), 0);
  const dailyOrderMap = new Map(dailyOrders.map(row => [row.day, row.count]));
  const recentOrderTotal = days.reduce((sum, day) => sum + (dailyOrderMap.get(day.key) ?? 0), 0);
  const previousSeven = days.slice(0, 7).reduce((sum, day) => sum + (dailyOrderMap.get(day.key) ?? 0), 0);
  const recentSeven = days.slice(7).reduce((sum, day) => sum + (dailyOrderMap.get(day.key) ?? 0), 0);
  const orderTrend = previousSeven > 0 ? Math.round((recentSeven - previousSeven) * 100 / previousSeven) : null;
  const orderCounts = new Map(orderStatuses.map(item => [item.status, item._count._all]));
  const orderFlow = [
    { status: 'NEW', label: 'Yeni', href: '/commerce/orders?status=NEW' },
    { status: 'CONFIRMED', label: 'Onaylandı', href: '/commerce/orders?status=CONFIRMED' },
    { status: 'PACKING', label: 'Hazırlanıyor', href: '/commerce/orders?status=PACKING' },
    { status: 'SHIPPED', label: 'Kargolandı', href: '/commerce/orders?status=SHIPPED' },
  ];
  const maxCount = Math.max(1, ...dailyOrderMap.values());
  const metrics = [
    { title: 'Açık siparişler', value: openOrders, href: '/commerce/orders?status=OPEN', note: orders.toLocaleString('tr-TR')+' toplam kayıt', icon: 'orders' as const },
    { title: 'Ürün kataloğu', value: products, href: '/commerce/products', note: totalCreated+' yeni / 14 gün', icon: 'products' as const },
    { title: 'Stok bakiyesi', value: stockBalances?._sum.quantity ?? 0, href: '/commerce/inventory', note: (stockBalances?._count.id ?? 0)+' stok kalemi', icon: 'stock' as const },
    { title: 'Mağazalar', value: stores, href: '/commerce/stores', note: failedConnections+' bağlantı hatası', icon: 'stores' as const },
  ];
  return <div className="content dashboard-home dashboard-v3 commerce-mobile">
    <DashboardRefresh />
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow">ENTEGREPILOT / OPERASYON MASASI</span><h1 className="page-title">Genel Bakış</h1>
        <p className="page-subtitle">{auth.workspace?.name ?? 'Çalışma Alanı'} · Türkiye saati (UTC+3) · Gerçek çalışma alanı verileri</p></div>
      <Link className="action primary" href="/commerce/orders"><DashboardIcon name="orders" size={16}/> Siparişleri aç <span aria-hidden="true">↗</span></Link>
    </div>
    <section className="v3-operations" aria-label="Operasyon öncelikleri">
      <div className="v3-command">
        <div className="v3-command-kicker"><DashboardIcon name="activity" size={18}/> CANLI VERİ ÖZETİ <span>60 saniyede bir yenilenir</span></div>
        <h2>{openOrders ? openOrders.toLocaleString('tr-TR') + ' sipariş işlem bekliyor' : 'Bekleyen sipariş bulunmuyor'}</h2>
        <p>{openOrders ? 'Sipariş akışındaki bekleyen kayıtları öncelik sırasıyla yönetin.' : 'Yeni sipariş oluştuğunda iş akışında gösterilir.'}</p>
        <form className="v3-command-lookup" method="get" action="/commerce/products" role="search">
          <label htmlFor="dashboard-sku-lookup">SKU / barkod ile hızlı ürün bul</label>
          <div><input id="dashboard-sku-lookup" name="q" type="search" autoComplete="off"
            minLength={2} maxLength={80} placeholder="SKU, barkod veya ürün adı" enterKeyHint="search"/>
            <button type="submit">Katalogda bul <DashboardIcon name="arrow" size={16}/></button></div>
        </form>
        <div className="v3-command-actions">
          <Link href="/commerce/orders?status=OPEN" className="v3-command-primary">Bekleyen siparişleri aç <DashboardIcon name="arrow" size={17}/></Link>
          <Link href="/commerce/inventory?filter=LOW" className="v3-command-secondary">Düşük stokları incele <DashboardIcon name="arrow" size={16}/></Link>
        </div>
        <div className="v3-command-meta">
          <span><DashboardIcon name="warehouse" size={15}/>{warehouses.toLocaleString('tr-TR')} depo</span>
          <span><DashboardIcon name="stores" size={15}/>{stores.toLocaleString('tr-TR')} mağaza kaydı</span>
          <span><DashboardIcon name="activity" size={15}/>{notifications.toLocaleString('tr-TR')} okunmamış bildirim</span>
        </div>
      </div>
      <aside className="v3-priorities" aria-label="İşlem gerektiren kayıtlar">
        <div className="v3-priorities-header"><span>ÖNCELİKLİ İŞLER</span><DashboardIcon name="clock" size={18}/></div>
        <Link href="/commerce/orders?status=OPEN" className="v3-priority">
          <span className="v3-priority-icon"><DashboardIcon name="orders" size={19}/></span>
          <span><strong>Bekleyen siparişler</strong><small>Yeni, onaylı ve hazırlanan kayıtlar</small></span>
          <b>{openOrders.toLocaleString('tr-TR')}</b>
        </Link>
        <Link href="/commerce/inventory?filter=LOW" className="v3-priority">
          <span className="v3-priority-icon"><DashboardIcon name={lowStockBalances ? 'warning' : 'stock'} size={19}/></span>
          <span><strong>Düşük stok kayıtları</strong><small>Beş adet veya altında bakiye</small></span>
          <b>{lowStockBalances.toLocaleString('tr-TR')}</b>
        </Link>
        <Link href="/commerce/stores" className="v3-priority">
          <span className="v3-priority-icon"><DashboardIcon name={failedConnections ? 'warning' : 'check'} size={19}/></span>
          <span><strong>Bağlantı hataları</strong><small>Son hata bilgisi bulunan mağazalar</small></span>
          <b>{failedConnections.toLocaleString('tr-TR')}</b>
        </Link>
      </aside>
    </section>
    <section className="dashboard-stat-grid" aria-label="Mağaza göstergeleri">
      {metrics.map((item) => <Link className="dashboard-stat card" href={item.href} key={item.title}>
        <div className="dashboard-stat-caption"><span>{item.title}</span><span className="v3-metric-icon"><DashboardIcon name={item.icon} size={20}/></span></div>
        <strong>{item.value.toLocaleString('tr-TR')}</strong><small>{item.note} <span aria-hidden="true">↗</span></small>
      </Link>)}
    </section>
    <section className="card dashboard-flow-card" aria-label="Sipariş iş akışı">
      <div className="dashboard-section-heading"><div><h2>Sipariş iş akışı</h2><p>Çalışma alanındaki kayıtların güncel durumları</p></div><Link href="/commerce/orders">Siparişleri görüntüle →</Link></div>
      <div className="dashboard-flow-grid">{orderFlow.map(item => <Link href={item.href} className="dashboard-flow-step" key={item.status}>
        <span>{item.label}</span><strong>{(orderCounts.get(item.status as typeof orderStatuses[number]['status']) ?? 0).toLocaleString('tr-TR')}</strong><small>Listeyi aç ↗</small>
      </Link>)}</div>
    </section>
    <div className="dashboard-analytics-grid">
      <section className="card dashboard-analytics-card">
        <div className="dashboard-section-heading"><div><h2>Sipariş hareketi</h2><p>Son 14 gün · Türkiye saati · {recentOrderTotal.toLocaleString('tr-TR')} kayıt</p></div>
          <span className="v3-trend">{orderTrend === null ? 'Önceki dönem verisi yok' : (orderTrend > 0 ? '+' : '') + orderTrend + '% / önceki 7 gün'}</span></div>
        <div className="dashboard-bar-chart" role="img" aria-label={days.map(day=>`${day.label}: ${dailyOrderMap.get(day.key) ?? 0} sipariş`).join(', ')}>
          {days.map(day=><div className="dashboard-bar-column" key={day.key} title={`${day.label}: ${dailyOrderMap.get(day.key) ?? 0} sipariş`}>
            <span className="dashboard-bar" style={{height: dailyOrderMap.get(day.key) ? `${Math.max(4, ((dailyOrderMap.get(day.key) ?? 0) / maxCount) * 100)}%` : "0%"}} />
            <small>{Number(day.key.slice(-2))}</small>
          </div>)}
        </div>
        <p className="dashboard-chart-caption">{recentOrderTotal === 0 ? 'Bu dönemde sipariş kaydı bulunmuyor.' : 'Sütunlar kaydedilmiş siparişlerin oluşturulma tarihini gösterir.'} Son 14 günde ayrıca {totalCreated.toLocaleString('tr-TR')} ürün kaydedildi.</p>
      </section>
      <section className="card dashboard-connectors-card">
        <div className="dashboard-section-heading"><div><h2>Mağaza bağlantıları</h2><p>Güncel entegrasyon durumu</p></div><Link href="/commerce/stores">Tümünü gör →</Link></div>
        {connectors.length ? <div className="dashboard-connector-list">{connectors.map(c=>
          <div className="dashboard-connector-row" key={c.id}>
            <span className="dashboard-connector-icon" aria-hidden="true">{c.provider.slice(0,1).toUpperCase()}</span>
            <div><strong>{c.name}</strong><small>{c.provider} · {c.mode === 'MOCK' ? 'Simülasyon' : c.mode === 'STAGE' ? 'Test ortamı' : 'Canlı ortam kaydı'}</small></div>
            <span className={`badge ${c.mode !== 'MOCK' && c.enabled && c.lastValidatedAt && !c.lastErrorCode ? 'active' : ''}`}>{c.mode === 'MOCK' ? 'Simülasyon' : c.lastErrorCode ? 'Bağlantı hatası' : !c.enabled ? 'Kayıt pasif' : c.lastValidatedAt ? 'Kimlik doğrulandı' : 'Doğrulanmadı'}</span>
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
    <div className="dashboard-section-heading"><div><h2>Çalışma alanı araçları</h2><p>{warehouses.toLocaleString('tr-TR')} depo kayıtlı · Ticaret işlemlerine doğrudan erişim</p></div><Link href="/billing">Paket ve kredilerim →</Link></div>
    <section className="dashboard-module-grid" aria-label="Platform modülleri">{[
      {title:'Sipariş Yönetimi',description:'Yeni siparişleri, işlem sırasını ve durum geçmişini yönetin.',href:'/commerce/orders',tag:'OPERASYON'},
      {title:'Stok ve Depolar',description:'Depo bakiyelerini ve denetlenen stok hareketlerini görüntüleyin.',href:'/commerce/inventory',tag:'OPERASYON'},
      {title:'Ürün Kataloğu',description:'Ürün kayıtlarını ve barkodları yönetin.',href:'/commerce/products',tag:'KATALOG'},
      {title:'Mağaza Bağlantıları',description:'Kimlik doğrulama ve mağaza kayıtlarını izleyin.',href:'/commerce/stores',tag:'BAĞLANTILAR'},
      {title:'Veri Yönetimi',description:'İçe/dışa aktarma araçlarına erişin.',href:'/commerce/import-export',tag:'OPERASYON'},
      {title:'Görsel Stüdyosu',description:'Ürün görselleri için ayrı çalışma alanı.',href:'/create/design-studio',tag:'EKLENTİ'},
    ].map(module => <Link className="card dashboard-module" href={module.href} key={module.href}><span className="dashboard-module-tag">{module.tag}</span><h3>{module.title}</h3><p>{module.description}</p><span className="dashboard-module-action">Modülü aç →</span></Link>)}</section>
  </div>;
}
