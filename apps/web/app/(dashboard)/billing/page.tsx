import Link from 'next/link';
import { requireUserPage } from '../../../lib/auth';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const auth = await requireUserPage();
  const workspaceId = auth.workspace?.id;
  const now = new Date();
  const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
  const workspace = workspaceId ? await db.workspace.findUnique({
    where:{id:workspaceId},
    include:{package:{include:{features:{include:{feature:true}}}},overrides:{include:{feature:true}}},
  }):null;
  const quota = workspaceId ? await db.usageQuota.findMany({where:{workspaceId,periodKey},include:{feature:true}}) : [];
  const feature = workspace?.package?.features.find(f=>f.feature.key==='ai.design.generate');
  const override = workspace?.overrides.find(o=>o.feature.key==='ai.design.generate'&&(!o.validUntil||o.validUntil>now));
  const credits = override ? (override.enabled ? override.limit : 0) : (feature?.enabled ? feature.limit : 0);
  const used = quota.find(q=>q.feature.key==='ai.design.generate')?.used??0;
  return <div className="content">
    <span className="dashboard-eyebrow">HESAP / ABONELİK</span>
    <h1 className="page-title" style={{marginTop:12}}>Paketim ve Kredilerim</h1>
    <p className="page-subtitle">Çalışma alanınızın atanmış paketi ve güncel takvim ayı görsel üretim kullanımınız.</p>
    <div className="dashboard-stat-grid" style={{marginTop:24}}>
      <section className="card dashboard-stat"><span>Aktif Paket</span><strong style={{fontSize:22}}>{workspace?.package?.name??'Atanmamış'}</strong><small>{workspace?.package ? 'Yönetici tarafından atanmıştır' : 'Yönetici paket ataması gerekli'}</small></section>
      <section className="card dashboard-stat"><span>Aylık görsel kredisi</span><strong>{credits===null?'∞':credits??0}</strong><small>Mevcut paket limiti</small></section>
      <section className="card dashboard-stat"><span>Kullanılan kredi</span><strong>{used}</strong><small>{periodKey} döneminde</small></section>
      <section className="card dashboard-stat"><span>Kalan kredi</span><strong>{credits===null?'∞':Math.max(0,(credits??0)-used)}</strong><small>UTC takvim ayında yenilenir</small></section>
    </div>
    <section className="card" style={{marginTop:22}}>
      <h2 style={{marginTop:0}}>Paket özellikleri</h2>
      {workspace?.package?.features.length ? <div style={{display:'grid',gap:10}}>{workspace.package.features.filter(f=>f.enabled).map(f=><div className="row" key={f.featureId}><span>{f.feature.label}</span><span className="badge">{f.limit===null?'Dahil':`Aylık ${f.limit}`}</span></div>)}</div> : <p className="page-subtitle">Henüz bir paket atanmadı.</p>}
      <p className="page-subtitle">Bu ekran ücret tahsil etmez. Paket değişiklikleri yalnızca yetkili platform yöneticileri tarafından yapılır.</p>
      <Link className="action" href="/help/info">Destek ve bilgilendirme</Link>
    </section>
  </div>;
}
