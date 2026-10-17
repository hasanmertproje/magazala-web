import Link from 'next/link';
import { requireUserPage } from '../../../../lib/auth';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export default async function StoresPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const auth = await requireUserPage();
  const params = await searchParams;
  const canConfigure = auth.user.isSuperAdmin || auth.membership?.role === 'ADMIN';
  const connectors = auth.workspace ? await db.storeConnector.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, name: true, provider: true, mode: true, enabled: true,
      lastSyncAt: true, lastValidatedAt: true, lastErrorCode: true, _count: { select: { listings: true } }
    }
  }) : [];
  const metrics = [
    { title: 'Tanımlı mağazalar', value: connectors.length },
    { title: 'Doğrulanan bağlantılar', value: connectors.filter(c => c.enabled && c.lastValidatedAt && !c.lastErrorCode).length },
    { title: 'Ürün eşlemeleri', value: connectors.reduce((n,c) => n + c._count.listings,0) },
    { title: 'Bağlantı hataları', value: connectors.filter(c => c.lastErrorCode).length },
  ];
  return <div className="content">
    <span className="dashboard-eyebrow">MAĞAZA YÖNETİMİ</span>
    <h1 className="page-title" style={{marginTop:12}}>Mağazalar ve Entegrasyonlar</h1>
    <p className="page-subtitle">Pazaryeri bağlantılarını güvenli biçimde yönetin. Kimlik doğrulama testi ve gerçek sipariş/ürün senkronizasyonu birbirinden ayrıdır.</p>
    {params.notice ? <div className="card" role="status" style={{marginTop:18}}>İşlem tamamlandı: {params.notice}</div> : null}
    {params.error ? <div className="card" role="alert" style={{marginTop:18,color:'var(--danger)'}}>Bağlantı başarısız: {params.error}</div> : null}
    <section className="dashboard-stat-grid" style={{marginTop:24}}>{metrics.map(m =>
      <div key={m.title} className="card dashboard-stat"><span>{m.title}</span><strong>{m.value}</strong><small>Çalışma alanı verileri</small></div>)}</section>
    <section className="card" style={{marginTop:24}}>
      <div className="dashboard-section-heading"><div><h2>Mağaza bağlantıları</h2><p>Gerçek bağlantı kayıtları ve doğrulama durumu</p></div></div>
      {connectors.length ? <div className="store-table-wrap"><table className="store-table">
        <thead><tr><th>Mağaza</th><th>Sağlayıcı</th><th>Ortam</th><th>Bağlantı</th><th>Son doğrulama</th><th>Eşlemeler</th><th>Son senkronizasyon</th><th>İşlem</th></tr></thead>
        <tbody>{connectors.map(c => <tr key={c.id}>
          <td><strong>{c.name}</strong></td><td>{c.provider}</td><td>{c.mode}</td>
          <td>{c.lastErrorCode ? 'Bağlantı hatası: '+c.lastErrorCode : !c.enabled ? 'Kayıt pasif' : c.lastValidatedAt ? 'Kimlik doğrulandı (otomatik senkronizasyon yok)' : 'Doğrulanmadı'}</td>
          <td>{c.lastValidatedAt?.toLocaleString('tr-TR') ?? 'Doğrulanmadı'}</td>
          <td>{c._count.listings}</td><td>{c.lastSyncAt?.toLocaleString('tr-TR') ?? 'Henüz yok'}</td>
          <td>{canConfigure && c.provider === 'trendyol' ?
            <form action={'/api/commerce/stores/'+c.id+'/test'} method="post"><button className="action" type="submit">Bağlantıyı test et</button></form> : '—'}</td>
        </tr>)}</tbody></table></div>
        : <div className="empty"><div><strong>Henüz mağaza bağlantısı yok</strong><p>Satıcı hesabınızın bağlantı bilgileriyle yeni mağaza tanımlayabilirsiniz.</p></div></div>}
    </section>
    {canConfigure ? <section className="card" style={{marginTop:20}}>
      <h2 style={{marginTop:0}}>Trendyol mağazası tanımla</h2>
      <p className="page-subtitle">Satıcı bilgileri şifrelenmiş olarak saklanır. Test yalnızca güncel V2 ürün listeleme endpoint'ine salt okunur bir istek gönderir. Otomatik sipariş, stok veya ürün senkronizasyonu henüz etkin değildir.</p>
      <form action="/api/commerce/stores" method="post" autoComplete="off" className="commerce-product-form">
        <label>Mağaza adı<input className="input" name="name" minLength={2} maxLength={100} required /></label>
        <label>Trendyol satıcı ID<input className="input" name="sellerId" inputMode="numeric" pattern="[0-9]{1,15}" required /></label>
        <label>Ortam<select className="input" name="mode" defaultValue="STAGE"><option value="STAGE">Test (STAGE)</option><option value="PRODUCTION">Canlı API (yalnız test)</option></select></label>
        <label>API Key<input className="input" name="apiKey" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>API Secret<input className="input" name="apiSecret" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button className="action primary" type="submit">Bilgileri güvenli kaydet</button>
      </form>
      <p className="page-subtitle">API bilgileri Trendyol satıcı panelinden alınmalıdır. Gizli anahtarları GitHub'a veya destek mesajlarına göndermeyin.</p>
    </section> : <section className="card" style={{marginTop:20}}><p>Yeni bağlantı tanımlamak için çalışma alanı yöneticisi yetkisi gerekir.</p></section>}
    <p className="page-subtitle" style={{marginTop:18}}>Entegrasyon belgeleri: <Link href="/help/info">Platform bilgileri</Link>. Doğrulama, otomatik senkronizasyonun başarıyla çalıştığı anlamına gelmez.</p>
  </div>;
}
