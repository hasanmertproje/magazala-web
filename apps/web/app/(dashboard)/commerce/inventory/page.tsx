import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { requireUserPage } from '../../../../lib/auth';
import { assertFeatureEnabled } from '../../../../lib/entitlements';
import { db } from '../../../../lib/db';

export const dynamic='force-dynamic';

export default async function InventoryPage({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}) {
  const auth=await requireUserPage();
  if(!auth.workspace)return <div className="content"><h1 className="page-title">Çalışma alanı bulunamadı</h1></div>;
  const params=await searchParams;
  let allowed=true;
  try{await assertFeatureEnabled(auth.workspace.id,auth.user.isSuperAdmin,'inventory.basic');}catch{allowed=false;}
  if(!allowed)return <div className="content"><h1 className="page-title">Stok ve Depo</h1><div className="card" style={{marginTop:22}}>Bu modül çalışma alanı paketinde etkin değil.</div></div>;
  const canAdjust=auth.user.isSuperAdmin||auth.membership?.role==='ADMIN';
  const workspaceId=auth.workspace.id;
  const [warehouses,products,movements]=await Promise.all([
    db.warehouse.findMany({where:{workspaceId},orderBy:{name:'asc'},take:50,
      include:{balances:{include:{product:{select:{id:true,name:true,internalSku:true}}},take:200,orderBy:{updatedAt:'desc'}}}}),
    db.product.findMany({where:{workspaceId},select:{id:true,name:true,internalSku:true},orderBy:{name:'asc'},take:300}),
    db.stockMovement.findMany({where:{workspaceId},include:{product:{select:{name:true}},warehouse:{select:{name:true}}},orderBy:{createdAt:'desc'},take:30}),
  ]);
  const totalOnHand=warehouses.reduce((n,w)=>n+w.balances.reduce((m,i)=>m+i.onHand,0),0);
  const totalReserved=warehouses.reduce((n,w)=>n+w.balances.reduce((m,i)=>m+i.reserved,0),0);
  return <div className="content">
    <span className="dashboard-eyebrow">MAĞAZA YÖNETİMİ / STOK</span>
    <h1 className="page-title" style={{marginTop:12}}>Stok ve Depo</h1>
    <p className="page-subtitle">Depolar, kullanılabilir stoklar ve denetlenebilir stok hareketleri. Pazaryerine otomatik stok gönderimi bu Beta modülünde henüz etkin değildir.</p>
    {params.notice?<div className="card" role="status" style={{marginTop:18}}>İşlem tamamlandı: {params.notice}</div>:null}
    {params.error?<div className="card" role="alert" style={{marginTop:18,color:'var(--danger)'}}>İşlem tamamlanamadı: {params.error}</div>:null}
    <section className="dashboard-stat-grid" style={{marginTop:22}}>
      {[{name:'Depolar',value:warehouses.length},{name:'Toplam stok',value:totalOnHand},{name:'Rezerve stok',value:totalReserved},{name:'Kullanılabilir',value:totalOnHand-totalReserved}].map(m=>
        <div className="card dashboard-stat" key={m.name}><span>{m.name}</span><strong>{m.value.toLocaleString('tr-TR')}</strong><small>Çalışma alanı verileri</small></div>)}
    </section>
    {canAdjust?<section className="card" style={{marginTop:20}}>
      <h2 style={{marginTop:0}}>Depo ve stok işlemleri</h2>
      <div className="dashboard-analytics-grid">
        <form action="/api/commerce/inventory/warehouses" method="post" className="inventory-form">
          <h3>Yeni depo</h3>
          <label>Depo adı<input className="input" name="name" required minLength={2} maxLength={120}/></label>
          <label>Depo kodu<input className="input" name="code" required minLength={2} maxLength={32} pattern="[A-Za-z0-9_-]+"/></label>
          <button className="action primary" type="submit">Depo oluştur</button>
        </form>
        <form action="/api/commerce/inventory/adjust" method="post" className="inventory-form">
          <h3>Stok hareketi oluştur</h3>
          <input type="hidden" name="idempotencyKey" value={randomUUID()}/>
          <label>Depo<select className="input" name="warehouseId" required defaultValue=""><option value="" disabled>Depo seçin</option>{warehouses.filter(w=>w.active).map(w=><option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}</select></label>
          <label>Ürün<select className="input" name="productId" required defaultValue=""><option value="" disabled>Ürün seçin</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.internalSku?' · '+p.internalSku:''}</option>)}</select></label>
          <label>Miktar (+ giriş / - çıkış)<input className="input" name="delta" type="number" step="1" min="-100000" max="100000" required placeholder="Örnek: 25 veya -3"/></label>
          <label>İşlem nedeni<select className="input" name="reason" defaultValue="MANUAL_ADJUSTMENT"><option value="INITIAL_STOCK">İlk stok</option><option value="PURCHASE">Alım</option><option value="RETURN">İade</option><option value="MANUAL_ADJUSTMENT">Manuel düzeltme</option><option value="CORRECTION">Sayım farkı</option></select></label>
          <button className="action primary" type="submit" disabled={warehouses.length===0||products.length===0}>Stok hareketini kaydet</button>
          {products.length===0?<Link href="/commerce/products" className="dashboard-module-action">Önce ürün ekle →</Link>:null}
        </form>
      </div>
    </section>:null}
    <section className="card" style={{marginTop:20}}><div className="dashboard-section-heading"><div><h2>Stok bakiyeleri</h2><p>Depo ve ürün bazlı gerçek kayıtlar</p></div></div>
      {warehouses.some(w=>w.balances.length)>0?<div className="store-table-wrap"><table className="store-table"><thead><tr><th>Depo</th><th>Ürün</th><th>SKU</th><th>Stok</th><th>Rezerve</th><th>Kullanılabilir</th></tr></thead><tbody>{warehouses.flatMap(w=>w.balances.map(i=><tr key={i.id}><td>{w.name}</td><td>{i.product.name}</td><td>{i.product.internalSku??'—'}</td><td>{i.onHand}</td><td>{i.reserved}</td><td>{i.onHand-i.reserved}</td></tr>))}</tbody></table></div>:<p className="page-subtitle">Henüz stok bakiyesi bulunmuyor. Depo ve ürün oluşturduktan sonra ilk stok hareketini kaydedebilirsiniz.</p>}
    </section>
    <section className="card" style={{marginTop:20}}><div className="dashboard-section-heading"><div><h2>Son stok hareketleri</h2><p>Geriye dönük denetim kayıtları</p></div></div>
      {movements.length?<div className="store-table-wrap"><table className="store-table"><thead><tr><th>Zaman</th><th>Depo</th><th>Ürün</th><th>Değişim</th><th>Önce → Sonra</th><th>Neden</th></tr></thead><tbody>{movements.map(m=><tr key={m.id}><td>{m.createdAt.toLocaleString('tr-TR')}</td><td>{m.warehouse.name}</td><td>{m.product.name}</td><td>{m.delta>0?'+':''}{m.delta}</td><td>{m.beforeQuantity} → {m.afterQuantity}</td><td>{m.reason}</td></tr>)}</tbody></table></div>:<p className="page-subtitle">Henüz stok hareketi yok.</p>}
    </section>
  </div>;
}
