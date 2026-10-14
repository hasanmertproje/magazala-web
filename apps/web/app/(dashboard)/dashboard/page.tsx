import Link from 'next/link';
import { requireUserPage } from '../../../lib/auth';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const modules = [
  { title: 'Tasarım Stüdyosu', description: 'Yeni tasarımlar oluşturun ve görsel geçmişinizi yönetin.', href: '/create/design-studio', tag: 'Üretim' },
  { title: 'Ürün Araştırması', description: 'Ürün fikirlerini değerlendirin, araştırma oturumlarını inceleyin.', href: '/create/product-intelligence', tag: 'Araştırma' },
  { title: 'Ürün Yönetimi', description: 'Ürün kayıtlarına ve barkod araçlarına erişin.', href: '/commerce/products', tag: 'Beta' },
  { title: 'Mağaza Bağlantıları', description: 'Pazaryeri entegrasyon hazırlıklarını görüntüleyin.', href: '/commerce/stores', tag: 'Önizleme' },
];

export default async function DashboardPage() {
  const auth = await requireUserPage();
  const workspaceId = auth.workspace?.id;
  const [projects, assets, products, unread] = await Promise.all([
    workspaceId ? db.project.count({ where: { workspaceId } }) : Promise.resolve(0),
    workspaceId ? db.asset.count({ where: { workspaceId } }) : Promise.resolve(0),
    workspaceId ? db.product.count({ where: { workspaceId } }) : Promise.resolve(0),
    db.notification.count({ where: { userId: auth.user.id, readAt: null } }),
  ]);
  return <div className="content dashboard-home">
    <div className="dashboard-heading">
      <div><span className="dashboard-eyebrow">ÇALIŞMA ALANI GENEL BAKIŞI</span><h1 className="page-title">Kontrol Paneli</h1>
        <p className="page-subtitle">{auth.workspace?.name ?? 'Sistem'} için çalışma özeti ve hızlı erişim.</p></div>
      <Link className="action primary" href="/create/design-studio">Yeni çalışma başlat <span aria-hidden="true">→</span></Link>
    </div>
    <section className="dashboard-stat-grid" aria-label="Çalışma alanı istatistikleri">
      {[{name:'Projeler',value:projects,href:'/workspace/projects'},{name:'Dosyalar',value:assets,href:'/workspace/assets'},{name:'Ürün kayıtları',value:products,href:'/commerce/products'},{name:'Okunmamış bildirimler',value:unread,href:'/notifications'}].map(item =>
        <Link className="dashboard-stat card" href={item.href} key={item.name}><span>{item.name}</span><strong>{item.value.toLocaleString('tr-TR')}</strong><small>Detayları görüntüle →</small></Link>)}
    </section>
    <div className="dashboard-section-heading"><div><h2>Çalışma alanları</h2><p>En sık kullanılan araç ve modüller</p></div><Link href="/help/features">Tüm özellikler →</Link></div>
    <section className="dashboard-module-grid" aria-label="Platform modülleri">{modules.map(module =>
      <Link className="card dashboard-module" href={module.href} key={module.href}><span className="dashboard-module-tag">{module.tag}</span><h3>{module.title}</h3><p>{module.description}</p><span className="dashboard-module-action">Modülü aç <span aria-hidden="true">→</span></span></Link>)}</section>
    <div className="card dashboard-note"><div><strong>EntegrePilot Workspace</strong><p>Geliştirme aşamasındaki entegrasyonlar açıkça önizleme olarak işaretlenmiştir. Raporlanan sayılar çalışma alanınızdaki gerçek kayıtlardan alınır.</p></div><Link className="action" href="/help/info">Platform hakkında</Link></div>
  </div>;
}
