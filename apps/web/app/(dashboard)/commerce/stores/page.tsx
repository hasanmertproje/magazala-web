import type { Prisma } from '@prisma/client';
import Link from 'next/link';
import { requireUserPage } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import { clampPage, parsePage } from '../../../../lib/order-filters';
import { parseCommerceSearch } from '../../../../lib/commerce-search';
import { connectorCredentialState, connectorPageUrl, parseConnectorFilter } from '../../../../lib/connector-filters';

export const dynamic = 'force-dynamic';
const PAGE_SIZE=15;

export default async function StoresPage({searchParams}:{searchParams:Promise<{notice?:string;error?:string;q?:string;status?:string;page?:string;create?:string}>}) {
  const auth=await requireUserPage();
  const params=await searchParams;
  const workspaceId=auth.workspace?.id;
  const canConfigure=auth.user.isSuperAdmin||auth.membership?.role==='ADMIN';
  const search=parseCommerceSearch(params.q);
  const filter=parseConnectorFilter(params.status);

  const connectionCondition:Prisma.StoreConnectorWhereInput =
    filter==='MOCK'?{mode:'MOCK'}:
    filter==='ERROR'?{lastErrorCode:{not:null}}:
    filter==='VERIFIED'?{mode:{not:'MOCK'},enabled:true,lastValidatedAt:{not:null},lastErrorCode:null}:
    filter==='UNVERIFIED'?{mode:{not:'MOCK'},lastValidatedAt:null,lastErrorCode:null}:{};
  const where:Prisma.StoreConnectorWhereInput={
    workspaceId: workspaceId??'',
    ...connectionCondition,
    ...(search?{OR:[{name:{contains:search,mode:'insensitive'}},{provider:{contains:search,mode:'insensitive'}}]}:{}),
  };
  const [total,verified,listingCount,errors,filteredTotal]=workspaceId?await Promise.all([
    db.storeConnector.count({where:{workspaceId}}),
    db.storeConnector.count({where:{workspaceId,mode:{not:'MOCK'},enabled:true,lastValidatedAt:{not:null},lastErrorCode:null}}),
    db.marketplaceListing.count({where:{connector:{workspaceId}}}),
    db.storeConnector.count({where:{workspaceId,lastErrorCode:{not:null}}}),
    db.storeConnector.count({where}),
  ]):[0,0,0,0,0];
  const page=clampPage(parsePage(params.page),filteredTotal,PAGE_SIZE);
  const pages=Math.max(1,Math.ceil(filteredTotal/PAGE_SIZE));
  const connectors=workspaceId?await db.storeConnector.findMany({
    where,orderBy:[{updatedAt:'desc'},{id:'desc'}],
    skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE,
    select:{id:true,name:true,provider:true,mode:true,enabled:true,lastSyncAt:true,
      lastValidatedAt:true,lastErrorCode:true,_count:{select:{listings:true}}},
  }):[];
  const metrics=[
    {title:'Mağaza kayıtları',value:total,detail:'Tüm ortamlar'},
    {title:'Kimlik doğrulandı',value:verified,detail:'Senkronizasyon anlamına gelmez'},
    {title:'Ürün eşlemeleri',value:listingCount,detail:'Kayıtlı eşleme sayısı'},
    {title:'Bağlantı hataları',value:errors,detail:'Son bilinen hata'},
  ];
  const statusNames:Record<string,string>={
    SIMULATED:'Simülasyon',ERROR:'Doğrulama hatası',INACTIVE:'Pasif kayıt',
    VERIFIED:'Kimlik doğrulandı',UNVERIFIED:'Doğrulanmadı',
  };
  const pageLink=(next:number)=>connectorPageUrl(next,search,filter);
  return <div className="content commerce-mobile connector-workbench">
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow">MAĞAZA YÖNETİMİ / BAĞLANTILAR</span>
        <h1 className="page-title" style={{marginTop:12}}>Mağazalar ve Entegrasyonlar</h1>
        <p className="page-subtitle">Kimlik doğrulaması, mağaza kaydı ve veri senkronizasyonu farklı aşamalardır. Doğrulanan kimlik bilgileri otomatik sipariş/stok aktarımı yapmaz.</p>
      </div>
      {canConfigure?<Link className="action primary" href="/commerce/stores?create=1#new-store">Mağaza ekle</Link>:null}
    </div>
    {params.notice?<p className="card" role="status">Mağaza işlemi kaydedildi.</p>:null}
    {params.error?<p className="card" role="alert" style={{color:'var(--danger)'}}>Bağlantı işlemi başarısız: {params.error}</p>:null}
    <section className="connector-summary" aria-label="Entegrasyon kayıtlarının durumu">
      {metrics.map(m=><div key={m.title} className="connector-summary-item">
        <span>{m.title}</span><strong>{m.value.toLocaleString('tr-TR')}</strong><small>{m.detail}</small>
      </div>)}
    </section>
    <section className="card connector-register" aria-label="Mağaza kayıtları">
      <div className="dashboard-section-heading"><div><h2>Bağlantı kayıtları</h2>
        <p>{filteredTotal.toLocaleString('tr-TR')} eşleşme · {total.toLocaleString('tr-TR')} toplam · Sayfa {page}/{pages}</p></div></div>
      <nav className="commerce-quick-filters" aria-label="Bağlantı durumları">
        {[{status:undefined,label:'Tümü'},{status:'ERROR' as const,label:'Hatalar'},
          {status:'VERIFIED' as const,label:'Doğrulanan'},{status:'UNVERIFIED' as const,label:'Doğrulanmayan'},
          {status:'MOCK' as const,label:'Simülasyon'}].map(item=>
          <Link key={item.status??'ALL'} href={connectorPageUrl(1,search,item.status)}
            className={'commerce-filter-chip'+((filter??'')===(item.status??'')?' is-current':'')}
            aria-current={(filter??'')===(item.status??'')?'page':undefined}>{item.label}</Link>)}
      </nav>
      <form method="get" action="/commerce/stores" className="commerce-query-form" role="search">
        <label htmlFor="connector-search">Mağaza veya sağlayıcı
          <input id="connector-search" className="input" name="q" type="search" maxLength={80} defaultValue={search} placeholder="Mağaza adında ara"/>
        </label>
        <label htmlFor="connector-filter">Bağlantı durumu
          <select className="input" name="status" id="connector-filter" defaultValue={filter??''}>
            <option value="">Tüm durumlar</option><option value="ERROR">Hata var</option>
            <option value="VERIFIED">Kimlik doğrulandı</option><option value="UNVERIFIED">Doğrulanmadı</option>
            <option value="MOCK">Simülasyon</option>
          </select>
        </label>
        <button type="submit" className="action primary">Filtrele</button>
        {(search||filter)?<Link className="action" href="/commerce/stores">Temizle</Link>:null}
      </form>
      {connectors.length?<div className="store-table-wrap"><table className="store-table">
        <thead><tr><th>Mağaza</th><th>Sağlayıcı</th><th>Ortam</th><th>Kimlik durumu</th><th>Son doğrulama</th><th>Eşlemeler</th><th>Son senkronizasyon</th><th>İşlem</th></tr></thead>
        <tbody>{connectors.map(c=>{
          const state=connectorCredentialState(c);
          return <tr key={c.id}>
            <td data-label="Mağaza"><strong>{c.name}</strong></td>
            <td data-label="Sağlayıcı">{c.provider}</td>
            <td data-label="Ortam">{c.mode==='MOCK'?'Simülasyon':c.mode==='STAGE'?'Test ortamı':'Canlı API ortamı'}</td>
            <td data-label="Kimlik durumu"><span className={'connection-status connection-'+state.toLowerCase()}>{statusNames[state]}</span>
              {c.lastErrorCode?<small className="connector-error-code">Hata kodu: {c.lastErrorCode}</small>:null}</td>
            <td data-label="Son doğrulama">{c.mode==='MOCK'?'Uygulanamaz':c.lastValidatedAt?.toLocaleString('tr-TR')??'Henüz yok'}</td>
            <td data-label="Eşlemeler">{c._count.listings.toLocaleString('tr-TR')}</td>
            <td data-label="Son senkronizasyon">{c.mode==='MOCK'?'Yok · simülasyon':c.lastSyncAt?.toLocaleString('tr-TR')??'Henüz veri alınmadı'}</td>
            <td data-label="İşlem">{canConfigure&&c.provider==='trendyol'&&c.mode!=='MOCK'?
              <form action={'/api/commerce/stores/'+c.id+'/test'} method="post">
                <button className="action" type="submit">{state==='ERROR'?'Yeniden doğrula':'Bağlantıyı test et'}</button>
              </form>:<span className="connector-no-action">Test işlemi yok</span>}</td>
          </tr>;
        })}</tbody>
      </table></div>:<div className="dashboard-empty-state"><strong>Bu ölçütlerde bağlantı yok</strong>
        <p>{search||filter?'Durum veya arama filtresini temizleyin.':'Tanımlanmış mağaza bağlantısı bulunmuyor. Gerçek API yetkisi olmadan canlı aktarım başlamaz.'}</p>
        {(search||filter)?<Link href="/commerce/stores" className="action">Tüm kayıtları göster</Link>:null}
      </div>}
      <nav className="commerce-pagination" aria-label="Mağaza bağlantı sayfaları">
        <span>{filteredTotal.toLocaleString('tr-TR')} kayıt · Sayfa {page}/{pages}</span>
        {page>1?<Link href={pageLink(page-1)} className="action">← Önceki</Link>:null}
        {page<pages?<Link href={pageLink(page+1)} className="action">Sonraki →</Link>:null}
      </nav>
    </section>
    {canConfigure?<details id="new-store" className="card commerce-disclosure" open={params.create==='1'}>
      <summary><span><strong>Yeni Trendyol mağaza kaydı</strong><small>Kimlik bilgilerini şifreli saklayın; gerçek senkronizasyon henüz yoktur</small></span><span aria-hidden="true">+</span></summary>
      <p className="page-subtitle">Doğrulama yalnızca güncel V2 ürün listeleme endpoint'ine salt okunur istek gönderir; sipariş, stok, fatura veya kargo işlemi tetiklemez.</p>
      <form action="/api/commerce/stores" method="post" autoComplete="off" className="commerce-product-form">
        <label>Mağaza adı<input className="input" name="name" minLength={2} maxLength={100} required /></label>
        <label>Trendyol satıcı ID<input className="input" name="sellerId" inputMode="numeric" pattern="[0-9]{1,15}" required /></label>
        <label>Ortam<select className="input" name="mode" defaultValue="STAGE"><option value="STAGE">Test (STAGE)</option><option value="PRODUCTION">Canlı API (yalnız test)</option></select></label>
        <label>API Key<input className="input" name="apiKey" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>API Secret<input className="input" name="apiSecret" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button className="action primary" type="submit">Bilgileri güvenli kaydet</button>
      </form>
      <p className="page-subtitle">Gizli anahtarları GitHub'a veya destek mesajlarına göndermeyin.</p>
    </details>:null}
    <p className="page-subtitle" style={{marginTop:18}}>Daha fazla bilgi: <Link href="/help/info">Platform ve entegrasyon durumları</Link>. Kimlik doğrulaması tek başına veri senkronizasyonunu başlatmaz.</p>
  </div>;
}
