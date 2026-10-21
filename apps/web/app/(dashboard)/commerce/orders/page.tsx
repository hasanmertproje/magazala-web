import { requireUserPage } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { parseCommerceSearch, orderSearchCondition } from '../../../../lib/commerce-search';
import { ORDER_STATUSES, orderStatusCondition, parseOrderFilter, parsePage, clampPage, orderPageUrl } from '../../../../lib/order-filters';

export const dynamic='force-dynamic';
const statusLabels:Record<string,string>={NEW:'Yeni',CONFIRMED:'Onaylandı',PACKING:'Hazırlanıyor',SHIPPED:'Kargolandı',DELIVERED:'Teslim edildi',CANCELLED:'İptal'};
const nextStatuses:Record<string,string[]>={NEW:['CONFIRMED','CANCELLED'],CONFIRMED:['PACKING','CANCELLED'],PACKING:['SHIPPED','CANCELLED'],SHIPPED:['DELIVERED'],DELIVERED:[],CANCELLED:[]};

export default async function OrdersPage({searchParams}:{searchParams:Promise<{notice?:string;error?:string;status?:string;page?:string;q?:string;create?:string}>}){
 const auth=await requireUserPage();
 const params=await searchParams;
 const workspaceId=auth.workspace?.id;
 const canManage=auth.user.isSuperAdmin||auth.membership?.role==='ADMIN';
 const filter=parseOrderFilter(params.status);
 const search=parseCommerceSearch(params.q);
 const pageSize=20;
 const where=workspaceId?{workspaceId,...orderStatusCondition(filter),...orderSearchCondition(search)}:null;
 const [filteredTotal,total,pending,cancelled]=await Promise.all([
   where?db.commerceOrder.count({where}):0,
   workspaceId?db.commerceOrder.count({where:{workspaceId}}):0,
   workspaceId?db.commerceOrder.count({where:{workspaceId,status:{in:['NEW','CONFIRMED','PACKING']}}}):0,
   workspaceId?db.commerceOrder.count({where:{workspaceId,status:'CANCELLED'}}):0,
 ]);
 const page=clampPage(parsePage(params.page),filteredTotal,pageSize);
 const pages=Math.max(1,Math.ceil(filteredTotal/pageSize));
 const orders=where?await db.commerceOrder.findMany({
   where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*pageSize,take:pageSize,
   include:{connector:{select:{name:true}},_count:{select:{events:true}}},
 }):[];
 return <div className="content commerce-mobile order-workbench">
  <div className="dashboard-heading">
    <div><span className="dashboard-eyebrow">TİCARET OPERASYONLARI / SİPARİŞLER</span><h1 className="page-title">Sipariş Yönetimi</h1><p className="page-subtitle">Sipariş kayıtları, durum geçişleri ve denetlenebilir işlem geçmişi. Trendyol sipariş senkronizasyonu henüz bağlı değildir.</p></div>
    <div className="order-heading-actions"><span className="badge beta">İÇ OPERASYON · BETA</span>{canManage?<a className="action primary" href="/commerce/orders?create=1#new-order">Manuel sipariş ekle</a>:null}</div>
  </div>
  {params.notice?<p role="status" className="card">Sipariş işlemi başarıyla kaydedildi.</p>:null}
  {params.error?<p role="alert" className="card" style={{color:'var(--danger)'}}>İşlem başarısız: {params.error}</p>:null}
  <section className="order-status-strip" aria-label="Sipariş durum göstergeleri">
   {[{label:'Toplam sipariş',value:total},{label:'İşlem bekleyen',value:pending},{label:'Listelenen',value:orders.length},{label:'İptaller',value:cancelled}].map(item=>
     <div className="order-status-item" key={item.label}><span>{item.label}</span><strong>{item.value.toLocaleString('tr-TR')}</strong></div>
   )}
  </section>
  <section className="card order-records-workbench" style={{marginTop:20}}>
   <div className="dashboard-section-heading"><div><h2>Sipariş kayıtları</h2><p>{filteredTotal.toLocaleString('tr-TR')} eşleşen kayıt · Sayfa {page}/{pages} · Her sayfada {pageSize} sipariş</p></div></div>
   <nav className="commerce-quick-filters" aria-label="Sipariş iş listeleri">
    {[{key:'',label:'Tümü'},{key:'OPEN',label:'İşlem bekleyen'},{key:'NEW',label:'Yeni'},{key:'PACKING',label:'Hazırlanan'},{key:'SHIPPED',label:'Kargoda'}].map(item=>
      <a key={item.key} href={orderPageUrl(parseOrderFilter(item.key),1,search)} className={'commerce-filter-chip'+((filter??'')===item.key?' is-current':'')} aria-current={(filter??'')===item.key?'page':undefined}>{item.label}</a>
    )}
   </nav>
   <form method="get" action="/commerce/orders" className="commerce-query-form" role="search">
     <label htmlFor="order-search">Sipariş no veya müşteri referansı
       <input id="order-search" name="q" type="search" className="input" maxLength={80} defaultValue={search} placeholder="Sipariş veya müşteri kodunu ara" autoComplete="off"/>
     </label>
     <label htmlFor="order-status-filter">Durum
       <select id="order-status-filter" className="input" name="status" defaultValue={filter??''}><option value="">Tüm durumlar</option><option value="OPEN">İşlem bekleyen (tümü)</option>{ORDER_STATUSES.map(s=><option value={s} key={s}>{statusLabels[s]}</option>)}</select>
     </label>
     <button className="action primary" type="submit">Kayıtları bul</button>
     {(search||filter)?<a className="action" href="/commerce/orders">Temizle</a>:null}
   </form>
   <div className="store-table-wrap"><table className="store-table"><thead><tr><th>Sipariş</th><th>Kaynak</th><th>Durum</th><th>Tutar</th><th>Oluşturma</th><th>Durum güncelle</th></tr></thead><tbody>
    {orders.map(order=><tr key={order.id}>
     <td data-label="Sipariş"><strong>{order.orderNumber}</strong><div style={{fontSize:11,color:'var(--muted)'}}>{order.customerReference??'—'}</div></td>
     <td data-label="Kaynak">{order.connector?.name??'Manuel'}</td><td data-label="Durum"><span className="badge">{statusLabels[order.status]}</span></td>
     <td data-label="Tutar">{(order.totalMinor/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} {order.currency}</td>
     <td data-label="Oluşturma">{order.createdAt.toLocaleString('tr-TR')}</td>
     <td data-label="Durum güncelle">{canManage&&order.source==='MANUAL'&&nextStatuses[order.status].length?<form action={`/api/commerce/orders/${order.id}/status`} method="post" style={{display:'flex',gap:8,alignItems:'center'}}>
       <select className="input" name="status" aria-label={order.orderNumber+' yeni durum'}>{nextStatuses[order.status].map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select>
       <button className="action" type="submit">Güncelle</button></form>:<span style={{color:'var(--muted)'}}>—</span>}</td>
    </tr>)}
    {!orders.length?<tr><td colSpan={6}>Bu arama ve durum seçiminde sipariş yok. Filtreyi temizleyebilir veya başka bir sipariş numarası arayabilirsiniz.</td></tr>:null}
   </tbody></table></div>
   <nav className="commerce-pagination" aria-label="Sipariş sayfaları">
     <span>{filteredTotal.toLocaleString('tr-TR')} kayıt · {page}/{pages}</span>
     {page>1?<a className="action" href={orderPageUrl(filter,page-1,search)}>← Önceki</a>:null}
     {page<pages?<a className="action" href={orderPageUrl(filter,page+1,search)}>Sonraki →</a>:null}
   </nav>
  </section>
  {canManage?<details id="new-order" className="card commerce-disclosure" open={params.create==='1'}>
   <summary><span><strong>Yeni manuel sipariş kaydı</strong><small>İç kayıt oluşturulur; harici mağazaya gönderim yapılmaz</small></span><span aria-hidden="true">+</span></summary>
   <p className="page-subtitle">Bu ekran müşteriye fatura veya pazaryerine gönderim oluşturmaz.</p>
   <form action="/api/commerce/orders" method="post" className="commerce-product-form">
    <label>Sipariş numarası<input className="input" name="orderNumber" minLength={3} maxLength={80} required placeholder="SIP-10001"/></label>
    <label>Müşteri referansı<input className="input" name="customerReference" maxLength={100} placeholder="İç müşteri kodu"/></label>
    <label>Tutar (kuruş)<input className="input" name="totalMinor" type="number" min={0} max={2000000000} required placeholder="125000"/></label>
    <label>Para birimi<select className="input" name="currency" defaultValue="TRY"><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
    <label className="commerce-product-description">Not<input className="input" name="notes" maxLength={1000}/></label>
    <button type="submit" className="action primary">Siparişi kaydet</button>
   </form>
  </details>:null}
 </div>;
}
