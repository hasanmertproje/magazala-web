import { requireUserPage } from '../../../../lib/auth';
import { assertFeatureEnabled } from '../../../../lib/entitlements';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export default async function ProductsPage({searchParams}:{searchParams:Promise<{notice?:string;error?:string}>}) {
  const auth=await requireUserPage();
  if(!auth.workspace)return <div className="content"><h1 className="page-title">Çalışma alanı bulunamadı</h1></div>;
  let available=true;
  try { await assertFeatureEnabled(auth.workspace.id,auth.user.isSuperAdmin,'commerce.products'); }
  catch { available=false; }
  const products=available?await db.product.findMany({
    where:{workspaceId:auth.workspace.id},orderBy:{updatedAt:'desc'},take:100,
    select:{id:true,name:true,internalSku:true,internalBarcode:true,status:true,price:true,currency:true,updatedAt:true}
  }):[];
  const params=await searchParams;
  return <div className="content">
    <span className="dashboard-eyebrow">MAĞAZA YÖNETİMİ</span><h1 className="page-title" style={{marginTop:12}}>Ürün Kataloğu</h1>
    <p className="page-subtitle">Merkezi ürün kayıtları, SKU ve barkodlar. Pazaryerine gönderim bağlantı ve senkronizasyon doğrulamasından sonra yapılabilir.</p>
    {params.notice?<p role="status" className="card" style={{marginTop:18}}>Ürün kaydı oluşturuldu.</p>:null}
    {params.error?<p role="alert" className="card" style={{marginTop:18,color:'var(--danger)'}}>İşlem tamamlanamadı: {params.error}</p>:null}
    {!available?<div className="card" style={{marginTop:20}}>Bu çalışma alanının paketinde ürün kataloğu kullanım yetkisi bulunmuyor.</div>:
    <><section className="card" style={{marginTop:22}}>
      <h2 style={{marginTop:0}}>Yeni ürün oluştur</h2>
      <form action="/api/commerce/products" method="post" className="commerce-product-form">
        <label>Ürün adı<input className="input" name="name" required minLength={2} maxLength={180}/></label>
        <label>SKU<input className="input" name="internalSku" maxLength={80}/></label>
        <label>Barkod<input className="input" name="internalBarcode" maxLength={80}/></label>
        <label>Fiyat<input className="input" name="price" type="number" min="0" step="0.01"/></label>
        <label>Para birimi<select className="input" name="currency" defaultValue="TRY"><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label className="commerce-product-description">Açıklama<textarea className="input" name="description" rows={2} maxLength={5000}/></label>
        <button type="submit" className="action primary">Taslak ürünü kaydet</button>
      </form>
    </section>
    <section className="card" style={{marginTop:20}}>
      <div className="dashboard-section-heading"><div><h2>Ürün kayıtları</h2><p>{products.length} kayıt gösteriliyor · son güncellenenler</p></div></div>
      {products.length?<div className="store-table-wrap"><table className="store-table"><thead><tr><th>Ürün</th><th>SKU</th><th>Barkod</th><th>Durum</th><th>Fiyat</th><th>Güncelleme</th></tr></thead><tbody>{products.map(product=><tr key={product.id}>
        <td><strong>{product.name}</strong></td><td>{product.internalSku??'—'}</td><td>{product.internalBarcode??'—'}</td><td>{product.status}</td>
        <td>{product.price!=null?`${product.price.toString()} ${product.currency??'TRY'}`:'—'}</td><td>{product.updatedAt.toLocaleDateString('tr-TR')}</td>
      </tr>)}</tbody></table></div>:
      <div className="empty"><div><strong>Henüz ürün bulunmuyor</strong><p>İlk ürününüzü yukarıdaki formdan oluşturun.</p></div></div>}
    </section></>}
  </div>;
}
