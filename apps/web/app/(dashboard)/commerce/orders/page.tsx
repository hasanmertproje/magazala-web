import { requireUserPage } from '../../../../lib/auth';
import { db } from '../../../../lib/db';

export const dynamic='force-dynamic';
const statusLabels:Record<string,string>={NEW:'Yeni',CONFIRMED:'Onaylandı',PACKING:'Hazırlanıyor',SHIPPED:'Kargolandı',DELIVERED:'Teslim edildi',CANCELLED:'İptal'};
const nextStatuses:Record<string,string[]>={NEW:['CONFIRMED','CANCELLED'],CONFIRMED:['PACKING','CANCELLED'],PACKING:['SHIPPED','CANCELLED'],SHIPPED:['DELIVERED'],DELIVERED:[],CANCELLED:[]};

export default async function OrdersPage({searchParams}:{searchParams:Promise<{notice?:string;error?:string;status?:string}>}){
 const auth=await requireUserPage();
 const params=await searchParams;
 const workspaceId=auth.workspace?.id;
 const canManage=auth.user.isSuperAdmin||auth.membership?.role==='ADMIN';
 const allowed=['NEW','CONFIRMED','PACKING','SHIPPED','DELIVERED','CANCELLED'];
 const filter=params.status&&allowed.includes(params.status)?params.status:undefined;
 const [orders,total,pending]=await Promise.all([
   workspaceId?db.commerceOrder.findMany({where:{workspaceId,...(filter?{status:filter as 'NEW'}:{})},orderBy:{createdAt:'desc'},take:100,include:{connector:{select:{name:true}},_count:{select:{events:true}}}}):[],
   workspaceId?db.commerceOrder.count({where:{workspaceId}}):0,
   workspaceId?db.commerceOrder.count({where:{workspaceId,status:{in:['NEW','CONFIRMED','PACKING']}}}):0,
 ]);
 return <div className="content">
  <div className="dashboard-heading">
    <div><span className="dashboard-eyebrow">TİCARET OPERASYONLARI / SİPARİŞLER</span><h1 className="page-title">Sipariş Yönetimi</h1><p className="page-subtitle">Sipariş kayıtları, durum geçişleri ve denetlenebilir işlem geçmişi. Trendyol sipariş senkronizasyonu henüz bağlı değildir.</p></div>
    <span className="badge beta">İÇ OPERASYON · BETA</span>
  </div>
  {params.notice?<p role="status" className="card">Sipariş işlemi başarıyla kaydedildi.</p>:null}
  {params.error?<p role="alert" className="card" style={{color:'var(--danger)'}}>İşlem başarısız: {params.error}</p>:null}
  <div className="dashboard-stat-grid">
   {[{label:'Toplam sipariş',value:total},{label:'İşlem bekleyen',value:pending},{label:'Listelenen',value:orders.length},{label:'Sipariş kaynağı',value:'Manuel / Test'}].map(x=><div className="card dashboard-stat" key={x.label}><span>{x.label}</span><strong style={typeof x.value==='string'?{fontSize:19}:{}}>{x.value}</strong><small>Gerçek veritabanı kaydı</small></div>)}
  </div>
  {canManage?<section className="card" style={{marginTop:22}}>
   <h2>Manuel sipariş kaydı</h2>
   <p className="page-subtitle">Bu ekran müşteriye fatura veya pazaryerine gönderim oluşturmaz.</p>
   <form action="/api/commerce/orders" method="post" className="commerce-product-form">
    <label>Sipariş numarası<input className="input" name="orderNumber" minLength={3} maxLength={80} required placeholder="SIP-10001"/></label>
    <label>Müşteri referansı<input className="input" name="customerReference" maxLength={100} placeholder="İç müşteri kodu"/></label>
    <label>Tutar (kuruş)<input className="input" name="totalMinor" type="number" min={0} max={2000000000} required placeholder="125000"/></label>
    <label>Para birimi<select className="input" name="currency" defaultValue="TRY"><option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option></select></label>
    <label className="commerce-product-description">Not<input className="input" name="notes" maxLength={1000}/></label>
    <button type="submit" className="action primary">Siparişi kaydet</button>
   </form>
  </section>:null}
  <section className="card" style={{marginTop:20}}>
   <div className="dashboard-section-heading"><div><h2>Sipariş kayıtları</h2><p>Son 100 sipariş · Çalışma alanınıza ait kayıtlar</p></div></div>
   <form method="get" action="/commerce/orders" style={{display:'flex',gap:10,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
    <label htmlFor="order-status-filter">Durum</label><select id="order-status-filter" className="input" name="status" defaultValue={filter??''} style={{maxWidth:230}}><option value="">Tüm durumlar</option>{allowed.map(s=><option value={s} key={s}>{statusLabels[s]}</option>)}</select><button className="action" type="submit">Filtrele</button>
   </form>
   <div className="store-table-wrap"><table className="store-table"><thead><tr><th>Sipariş</th><th>Kaynak</th><th>Durum</th><th>Tutar</th><th>Oluşturma</th><th>Durum güncelle</th></tr></thead><tbody>
    {orders.map(order=><tr key={order.id}>
     <td><strong>{order.orderNumber}</strong><div style={{fontSize:11,color:'var(--muted)'}}>{order.customerReference??'—'}</div></td>
     <td>{order.connector?.name??'Manuel'}</td><td><span className="badge">{statusLabels[order.status]}</span></td>
     <td>{(order.totalMinor/100).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} {order.currency}</td>
     <td>{order.createdAt.toLocaleString('tr-TR')}</td>
     <td>{canManage&&order.source==='MANUAL'&&nextStatuses[order.status].length?<form action={`/api/commerce/orders/${order.id}/status`} method="post" style={{display:'flex',gap:8,alignItems:'center'}}>
       <select className="input" name="status" aria-label={order.orderNumber+' yeni durum'}>{nextStatuses[order.status].map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select>
       <button className="action" type="submit">Güncelle</button></form>:<span style={{color:'var(--muted)'}}>—</span>}</td>
    </tr>)}
    {!orders.length?<tr><td colSpan={6}>Seçili filtrede sipariş kaydı bulunmuyor.</td></tr>:null}
   </tbody></table></div>
  </section>
 </div>;
}
