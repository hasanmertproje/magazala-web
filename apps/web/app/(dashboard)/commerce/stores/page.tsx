import Link from 'next/link';
import { requireUserPage } from '../../../../lib/auth';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export default async function StoresPage() {
  const auth = await requireUserPage();
  const connectors = await db.storeConnector.findMany({where:{workspaceId:auth.workspace.id},orderBy:{updatedAt:'desc'},select:{id:true,name:true,provider:true,mode:true,enabled:true,lastSyncAt:true,lastErrorCode:true,_count:{select:{listings:true}}}});
  return <div className="content">
    <span className="dashboard-eyebrow">MAĞAZA YÖNETİMİ</span>
    <h1 className="page-title" style={{marginTop:12}}>Mağazalar ve Entegrasyonlar</h1>
    <p className="page-subtitle">Bağlantı durumlarını, pazaryeri ürün eşlemelerini ve son senkronizasyon bilgilerini yönetin. Test ve önizleme bağlantıları gerçek pazaryeri verisi olarak gösterilmez.</p>
    <div className="dashboard-stat-grid" style={{marginTop:24}}>
      {[{title:'Tanımlı mağazalar',value:connectors.length},{title:'Aktif production bağlantıları',value:connectors.filter(c=>c.enabled&&c.mode==='PRODUCTION').length},{title:'Ürün eşlemeleri',value:connectors.reduce((total,c)=>total+c._count.listings,0)},{title:'Bağlantı hataları',value:connectors.filter(c=>c.lastErrorCode).length}].map(s=>
        <div className="card dashboard-stat" key={s.title}><span>{s.title}</span><strong>{s.value}</strong><small>Çalışma alanı verileri</small></div>)}
    </div>
    <section className="card" style={{marginTop:24}}>
      <h2 style={{marginTop:0}}>Pazaryeri bağlantıları</h2>
      {connectors.length ? <div className="store-table-wrap"><table className="store-table"><thead><tr><th>Mağaza</th><th>Sağlayıcı</th><th>Mod</th><th>Durum</th><th>Eşleme</th><th>Son senkronizasyon</th></tr></thead><tbody>{connectors.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.provider}</td><td>{c.mode}</td><td>{c.lastErrorCode?'Hata':c.enabled?'Aktif':'Pasif'}</td><td>{c._count.listings}</td><td>{c.lastSyncAt?.toLocaleString('tr-TR')??'Henüz yok'}</td></tr>)}</tbody></table></div>
        : <div className="empty"><div><strong>Henüz mağaza bağlantısı yok</strong><p>Trendyol ve diğer pazaryerlerinin canlı erişimi API kimlik bilgileri, bağlantı testi ve senkronizasyon güvenlik kontrolleri tamamlandıktan sonra etkinleştirilebilir.</p><Link className="action" href="/help/info">Entegrasyon bilgileri</Link></div></div>}
    </section>
  </div>;
}
