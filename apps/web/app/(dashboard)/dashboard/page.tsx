import Link from 'next/link';
import { requireUserPage } from '../../../lib/auth';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const modules = [
  { title: 'Mağaza Bağlantıları', description: 'Pazaryerlerinizi, bağlantı durumlarını ve ürün eşlemelerini takip edin.', href: '/commerce/stores', tag: 'ENTEGRASYON' },
  { title: 'Ürün Kataloğu', description: 'Merkezi ürün ve barkod kayıtlarınızı yönetin.', href: '/commerce/products', tag: 'ÜRÜNLER' },
  { title: 'Stok ve Depo', description: 'Stok altyapısı ve depo operasyonlarının hazırlık durumunu görüntüleyin.', href: '/commerce/inventory', tag: 'ÖNİZLEME' },
  { title: 'Görsel Stüdyosu', description: 'Ürün görselleri oluşturun ve kredilerinizi yönetin.', href: '/create/design-studio', tag: 'EKLENTİ' },
];

export default async function DashboardPage() {
  const auth = await requireUserPage();
  const workspaceId = auth.workspace?.id;
  const [stores, assets, products, unread] = await Promise.all([
    workspaceId ? db.storeConnector.count({ where: { workspaceId } }) : Promise.resolve(0),
    workspaceId ? db.asset.count({ where: { workspaceId } }) : Promise.resolve(0),
    workspaceId ? db.product.count({ where: { workspaceId } }) : Promise.resolve(0),
    db.notification.count({ where: { userId: auth.user.id, readAt: null } }),
  ]);
  return <div className="content dashboard-home">
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow">ÇALIŞMA ALANI GENEL BAKIŞI</span><h1 className="page-title">Kontrol Paneli</h1>
        <p className="page-subtitle">{auth.workspace?.name ?? 'Sistem'} için çalışma özeti ve hızlı erişim.</p></div>
      <Link className="action primary" href="/commerce/stores">Mağazaları yönet <span aria-hidden="true">→</span></Link>
    </div>
    <section className="dashboard-stat-grid" aria-label="Çalışma alanı istatistikleri">
      {[{name:'Mağaza bağlantıları',value:stores,href:'/commerce/stores'},{name:'Dosyalar',value:assets,href:'/workspace/assets'},{name:'Ürün kayıtları',value:products,href:'/commerce/products'},{name:'Okunmamış bildirimler',value:unread,href:'/notifications'}].map(item =>
        <Link className="dashboard-stat card" href={item.href} key={item.name}><span>{item.name}</span><strong>{item.value.toLocaleString('tr-TR')}</strong><small>Detayları görüntüle →</small></Link>)}
    </section>
    <div className="dashboard-section-heading"><div><h2>Mağaza yönetimi</h2><p>Tüm ticaret operasyonları ve destekleyici araçlar</p></div><Link href="/help/features">Tüm özellikler →</Link></div>
    <section className="dashboard-module-grid" aria-label="Platform modülleri">{modules.map(module =>
      <Link className="card dashboard-module" href={module.href} key={module.href}><span className="dashboard-module-tag">{module.tag}</span><h3>{module.title}</h3><p>{module.description}</p><span className="dashboard-module-action">Modülü aç <span aria-hidden="true">→</span></span></Link>)}</section>
    <div className="card dashboard-note"><div><strong>EntegrePilot Commerce</strong><p>Geliştirme aşamasındaki entegrasyonlar açıkça önizleme olarak işaretlenmiştir. Raporlanan sayılar çalışma alanınızdaki gerçek kayıtlardan alınır.</p></div><Link className="action" href="/help/info">Platform hakkında</Link></div>
  </div>;
}
