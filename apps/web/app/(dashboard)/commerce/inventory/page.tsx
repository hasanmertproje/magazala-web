import { randomUUID } from 'node:crypto';
import { requireUserPage } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { parsePage, clampPage } from '../../../../lib/order-filters';

export const dynamic='force-dynamic';

export default async function InventoryPage({searchParams}:{searchParams:Promise<{notice?:string;error?:string;filter?:string;page?:string}>}){
  const auth=await requireUserPage();
  const workspaceId=auth.workspace?.id;
  const params=await searchParams;
  const canManage=auth.user.isSuperAdmin||auth.membership?.role==='ADMIN';
  const lowOnly=params.filter==='LOW';
  const pageSize=50;
  const balanceWhere=workspaceId?{workspaceId,...(lowOnly?{quantity:{lte:5}}:{})}:null;
  const [warehouses,products,movements,stockTotals,stockMovementCount,filteredCount]=await Promise.all([
    workspaceId?db.warehouse.findMany({where:{workspaceId},orderBy:{name:'asc'}}):[],
    workspaceId?db.product.findMany({where:{workspaceId},select:{id:true,name:true,internalSku:true},orderBy:{name:'asc'},take:500}):[],
    workspaceId?db.stockMovement.findMany({where:{workspaceId},include:{product:{select:{name:true}},warehouse:{select:{name:true}}},orderBy:{createdAt:'desc'},take:15}):[],
    workspaceId?db.stockBalance.aggregate({where:{workspaceId},_sum:{quantity:true},_count:{id:true}}):null,
    workspaceId?db.stockMovement.count({where:{workspaceId}}):0,
    balanceWhere?db.stockBalance.count({where:balanceWhere}):0,
  ]);
  const page=clampPage(parsePage(params.page),filteredCount,pageSize);
  const pages=Math.max(1,Math.ceil(filteredCount/pageSize));
  const balancePage=(next:number)=>'/commerce/inventory'+
    '?'+new URLSearchParams({...lowOnly?{filter:'LOW'}:{},page:String(next)}).toString();
  const balances=balanceWhere?await db.stockBalance.findMany({
    where:balanceWhere,include:{product:{select:{name:true,internalSku:true}},warehouse:{select:{name:true,code:true}}},
    orderBy:[{updatedAt:'desc'},{id:'desc'}],skip:(page-1)*pageSize,take:pageSize,
  }):[];
  const total=stockTotals?._sum.quantity ?? 0;
  const balanceCount=stockTotals?._count.id ?? 0;
  return <div className="content commerce-mobile">
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow">TİCARET OPERASYONLARI / ENVANTER</span><h1 className="page-title">Stok ve Depo Yönetimi</h1><p className="page-subtitle">Depoların stok miktarları ve tüm manuel hareketleri kayıt altındadır. Pazaryerlerine stok gönderimi henüz etkin değildir.</p></div>
      <span className="badge beta">İÇ ENVANTER · BETA</span>
    </div>
    {params.notice?<p className="card" role="status">Stok veya depo işlemi kaydedildi.</p>:null}
    {params.error?<p className="card" role="alert" style={{color:'var(--danger)'}}>İşlem başarısız: {params.error}</p>:null}
    <section className="dashboard-stat-grid" aria-label="Stok özeti">
      {[{title:'Depo sayısı',value:warehouses.length},{title:'Stok kalemi',value:balanceCount},{title:'Toplam stok adedi',value:total},{title:'Stok hareketi',value:stockMovementCount,note:'Toplam hareket kaydı'}].map(x=><div className="card dashboard-stat" key={x.title}><span>{x.title}</span><strong>{x.value.toLocaleString('tr-TR')}</strong><small>{x.note??'Çalışma alanı verisi'}</small></div>)}
    </section>
    <div className="inventory-grid">
      <section className="card"><h2>Depolar</h2>
        {warehouses.length?<div className="inventory-warehouse-list">{warehouses.map(w=><div className="inventory-warehouse-row" key={w.id}><strong>{w.name}</strong><span className="badge">{w.code}</span></div>)}</div>:<p className="page-subtitle">Henüz depo oluşturulmadı.</p>}
        {canManage?<form action="/api/commerce/warehouses" method="post" className="inventory-form"><h3>Yeni depo</h3><label>Depo adı<input name="name" className="input" minLength={2} maxLength={100} required placeholder="Merkez Depo"/></label><label>Depo kodu<input name="code" className="input" required minLength={2} maxLength={24} pattern="[A-Za-z0-9_-]{2,24}" placeholder="MERKEZ"/></label><button type="submit" className="action primary">Depo oluştur</button></form>:null}
      </section>
      <section className="card"><h2>Stok düzeltmesi</h2><p className="page-subtitle">Her işlem izlenebilir bir hareket oluşturur. Eksi işlem mevcut stoktan fazlasını düşemez.</p>
        {canManage&&warehouses.length&&products.length?<form action="/api/commerce/stock" method="post" className="inventory-form">
          <input type="hidden" name="idempotencyKey" value={randomUUID()}/>
          <label>Depo<select name="warehouseId" className="input" required>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name} · {w.code}</option>)}</select></label>
          <label>Ürün<select name="productId" className="input" required>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.internalSku?' · '+p.internalSku:''}</option>)}</select></label>
          <label>Adet değişimi (+ / −)<input name="delta" className="input" type="number" min="-1000000" max="1000000" step="1" required placeholder="+10 veya -2"/></label>
          <label>İşlem gerekçesi<input name="reason" className="input" minLength={3} maxLength={200} required placeholder="Sayım düzeltmesi"/></label>
          <button type="submit" className="action primary">Stok hareketini kaydet</button>
        </form>:<p className="page-subtitle">{canManage?'Önce bir depo ve en az bir ürün oluşturun.':'Stok düzeltmesi için yönetici yetkisi gerekir.'}</p>}
      </section>
    </div>
    <section className="card" style={{marginTop:20}}><h2>Stok bakiyeleri</h2>
    <form action="/commerce/inventory" method="get" className="commerce-filterbar">
      <label htmlFor="inventory-filter">Göster</label>
      <select className="input" id="inventory-filter" name="filter" defaultValue={lowOnly?'LOW':''}>
        <option value="">Tüm bakiyeler</option><option value="LOW">Düşük stok (5 ve altı)</option>
      </select>
      <button type="submit" className="action">Filtrele</button>
      <span>{filteredCount.toLocaleString('tr-TR')} kayıt · Sayfa {page}/{pages}</span>
    </form>
    <div className="store-table-wrap"><table className="store-table"><thead><tr><th>Ürün</th><th>SKU</th><th>Depo</th><th>Adet</th><th>Güncelleme</th></tr></thead><tbody>
      {balances.map(b=><tr key={b.id}><td data-label="Ürün">{b.product.name}</td><td data-label="SKU">{b.product.internalSku??'—'}</td><td data-label="Depo">{b.warehouse.name} · {b.warehouse.code}</td><td data-label="Adet"><strong>{b.quantity}</strong></td><td data-label="Güncelleme">{b.updatedAt.toLocaleString('tr-TR')}</td></tr>)}
      {!balances.length?<tr><td colSpan={5}>Henüz stok kaydı yok.</td></tr>:null}
    </tbody></table></div>
    <nav className="commerce-pagination" aria-label="Stok sayfaları">
      <span>{filteredCount.toLocaleString('tr-TR')} bakiye · {page}/{pages}</span>
      {page>1?<a href={balancePage(page-1)} className="action">← Önceki</a>:null}
      {page<pages?<a href={balancePage(page+1)} className="action">Sonraki →</a>:null}
    </nav>
    </section>
    <section className="card" style={{marginTop:20}}><h2>Son stok hareketleri</h2><div className="store-table-wrap"><table className="store-table"><thead><tr><th>Tarih</th><th>Ürün</th><th>Depo</th><th>Değişim</th><th>Son bakiye</th><th>Gerekçe</th></tr></thead><tbody>
      {movements.map(m=><tr key={m.id}><td data-label="Tarih">{m.createdAt.toLocaleString('tr-TR')}</td><td data-label="Ürün">{m.product.name}</td><td data-label="Depo">{m.warehouse.name}</td><td data-label="Değişim">{m.quantityDelta>0?'+':''}{m.quantityDelta}</td><td data-label="Son bakiye">{m.quantityAfter}</td><td data-label="Gerekçe">{m.reason}</td></tr>)}
      {!movements.length?<tr><td colSpan={6}>Henüz hareket bulunmuyor.</td></tr>:null}
    </tbody></table></div></section>
  </div>;
}
