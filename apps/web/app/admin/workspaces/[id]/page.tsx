import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WorkspaceInviteManager } from '../../../../components/workspace-invite-manager';
import { db } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const closedRequirementStatuses = new Set(['RELEASED', 'REJECTED', 'MERGED']);

export default async function WorkspaceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string; error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [workspace, packages, features, usage, quotas, audits, generationCount] = await Promise.all([
    db.workspace.findUnique({
      where: { id },
      include: {
        package: { include: { features: { include: { feature: true } } } },
        members: { include: { user: true }, orderBy: { createdAt: 'asc' } },
        invitations: { include: { createdBy: { select: { email: true, displayName: true } } }, orderBy: { createdAt: 'desc' }, take: 30 },
        overrides: { include: { feature: true } },
        connectors: { orderBy: { updatedAt: 'desc' } },
        requirements: { orderBy: { updatedAt: 'desc' }, take: 12 },
        _count: { select: { products: true, projects: true, assets: true, discoveryConversations: true } },
      },
    }),
    db.package.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.feature.findMany({ orderBy: [{ module: 'asc' }, { label: 'asc' }] }),
    db.usageLedger.findMany({
      where: { workspaceId: id, startedAt: { gte: since } },
      select: { operation: true, success: true, latencyMs: true, startedAt: true },
      orderBy: { startedAt: 'desc' },
      take: 2000,
    }),
    db.usageQuota.findMany({ where: { workspaceId: id }, include: { feature: true }, orderBy: { periodKey: 'desc' }, take: 60 }),
    db.auditLog.findMany({ where: { workspaceId: id }, include: { actor: { select: { email: true, displayName: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.generation.count({ where: { workspaceId: id, createdAt: { gte: since } } }),
  ]);

  if (!workspace) notFound();

  const now = Date.now();
  const activeInvites = workspace.invitations.filter((item) => !item.acceptedAt && !item.revokedAt && item.expiresAt.getTime() > now);
  const openRequirements = workspace.requirements.filter((item) => !closedRequirementStatuses.has(item.status));
  const failures = usage.filter((item) => item.success === false).length;
  const measuredLatencies = usage.map((item) => item.latencyMs).filter((value): value is number => value != null);
  const averageLatency = measuredLatencies.length ? Math.round(measuredLatencies.reduce((sum, value) => sum + value, 0) / measuredLatencies.length) : null;
  const operationMap = new Map<string, { count: number; failures: number }>();
  for (const row of usage) {
    const current = operationMap.get(row.operation) ?? { count: 0, failures: 0 };
    current.count += 1;
    if (row.success === false) current.failures += 1;
    operationMap.set(row.operation, current);
  }
  const operations = [...operationMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  const returnTo = `/admin/workspaces/${workspace.id}`;

  return <div className="content">
    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><Link href="/admin/workspaces" style={{fontSize:12,color:'var(--muted)'}}>← Müşteriler</Link><h1 className="page-title" style={{marginTop:8}}>{workspace.name}</h1><p className="page-subtitle">{workspace.slug} · oluşturulma {workspace.createdAt.toLocaleString('tr-TR')}</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><span className={`badge ${workspace.package ? 'active' : ''}`}>{workspace.package?.name ?? 'PAKET YOK'}</span><span className="badge">{workspace.members.length} ÜYE</span>{activeInvites.length ? <span className="badge">{activeInvites.length} BEKLEYEN DAVET</span> : null}</div>
    </div>

    {query.notice ? <section className="card" style={{marginTop:14}}>İşlem tamamlandı.</section> : null}
    {query.error ? <section className="card" style={{marginTop:14,color:'var(--danger)'}}>İşlem tamamlanamadı: {query.error}</section> : null}

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:10,marginTop:20}}>
      <Metric label="Ürün" value={workspace._count.products}/><Metric label="Proje" value={workspace._count.projects}/><Metric label="Dosya" value={workspace._count.assets}/><Metric label="30g üretim" value={generationCount}/><Metric label="30g API/AI" value={usage.length}/><Metric label="Başarısız çağrı" value={failures}/><Metric label="Açık AI talebi" value={openRequirements.length}/><Metric label="Ort. gecikme" value={averageLatency == null ? '—' : `${averageLatency} ms`}/>
    </div>

    <div className="grid" style={{marginTop:18}}>
      <section className="card span-6">
        <h2 style={{marginTop:0}}>Paket</h2>
        <p className="page-subtitle">Workspace’in temel erişimini paket belirler; müşteri özelinde farklılık gerekiyorsa aşağıdaki feature override katmanını kullanın.</p>
        <form action={`/api/admin/workspaces/${workspace.id}/package`} method="post" style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:14}}>
          <input type="hidden" name="returnTo" value={returnTo}/>
          <select className="input" name="packageId" defaultValue={workspace.packageId ?? ''} style={{minWidth:220}}><option value="">Paket yok</option>{packages.map((pkg) => <option value={pkg.id} key={pkg.id}>{pkg.name}</option>)}</select>
          <button className="action primary" type="submit">Paketi güncelle</button>
        </form>
      </section>

      <section className="card span-6">
        <h2 style={{marginTop:0}}>Mağaza bağlantıları</h2>
        {workspace.connectors.length === 0 ? <p className="page-subtitle">Henüz mağaza bağlantısı yok. Commerce entegrasyonları production hazır olmadan aktif gösterilmeyecek.</p> : workspace.connectors.map((connector) => <div className="row" key={connector.id}><div><strong>{connector.name}</strong><div style={{fontSize:12,color:'var(--muted)'}}>{connector.provider}</div></div><div style={{display:'flex',gap:6}}><span className="badge">{connector.mode}</span><span className={`badge ${connector.enabled ? 'active' : ''}`}>{connector.enabled ? 'AÇIK' : 'KAPALI'}</span></div></div>)}
      </section>
    </div>

    <section className="card" style={{marginTop:18}}>
      <h2 style={{marginTop:0}}>Modüller & özel erişimler</h2>
      <p className="page-subtitle">Etkin sonuç; geçerli workspace override’ı varsa ondan, yoksa paketten gelir. Süresi dolmuş override otomatik olarak temel paket davranışına geri düşer.</p>
      <div style={{display:'grid',gap:10,marginTop:14}}>{features.map((feature) => {
        const packageRule = workspace.package?.features.find((item) => item.featureId === feature.id);
        const override = workspace.overrides.find((item) => item.featureId === feature.id);
        const overrideValid = Boolean(override && (!override.validUntil || override.validUntil.getTime() > now));
        const effectiveEnabled = overrideValid ? Boolean(override?.enabled) : Boolean(packageRule?.enabled);
        const effectiveLimit = overrideValid ? (override?.limit ?? null) : (packageRule?.limit ?? null);
        return <div key={feature.id} style={{padding:14,border:'1px solid var(--line)',borderRadius:12}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><strong>{feature.label}</strong><div style={{color:'var(--muted)',fontSize:12}}>{feature.module} · {feature.status} · {feature.key}</div></div><div style={{display:'flex',gap:6,flexWrap:'wrap'}}><span className={`badge ${effectiveEnabled ? 'active' : ''}`}>{effectiveEnabled ? 'ERİŞİM AÇIK' : 'ERİŞİM KAPALI'}</span><span className="badge">{effectiveLimit == null ? 'LİMİT YOK' : `LİMİT ${effectiveLimit}`}</span>{overrideValid ? <span className="badge">ÖZEL OVERRIDE</span> : null}</div></div>
          <form action={`/api/admin/workspaces/${workspace.id}/feature-overrides`} method="post" style={{display:'grid',gridTemplateColumns:'auto minmax(100px,150px) minmax(180px,220px) auto auto',gap:8,alignItems:'center',marginTop:10}}>
            <input type="hidden" name="featureId" value={feature.id}/><input type="hidden" name="returnTo" value={returnTo}/>
            <label style={{display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" name="enabled" defaultChecked={overrideValid ? override?.enabled : effectiveEnabled}/> Açık</label>
            <input className="input" name="limit" type="number" min="0" defaultValue={overrideValid ? (override?.limit ?? '') : (effectiveLimit ?? '')} placeholder="Limit"/>
            <input className="input" name="validUntil" type="datetime-local" defaultValue={override?.validUntil ? override.validUntil.toISOString().slice(0,16) : ''}/>
            <button className="action" type="submit">Override kaydet</button>
            {override ? <button className="action" type="submit" formAction={`/api/admin/workspaces/${workspace.id}/feature-overrides/${feature.id}/remove`}>Override kaldır</button> : null}
          </form>
        </div>;
      })}</div>
    </section>

    <div className="grid" style={{marginTop:18}}>
      <section className="card span-7">
        <h2 style={{marginTop:0}}>Üyeler</h2>
        {workspace.members.map((membership) => <div key={membership.userId} className="row" style={{alignItems:'center'}}><div><strong>{membership.user.displayName ?? membership.user.email}</strong><div style={{color:'var(--muted)',fontSize:12}}>{membership.user.email}{membership.user.isSuperAdmin ? ' · SUPER ADMIN' : ''}</div></div><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><form action={`/api/admin/workspaces/${workspace.id}/members/${membership.userId}/role`} method="post" style={{display:'flex',gap:6}}><input type="hidden" name="returnTo" value={returnTo}/><select className="input" name="role" defaultValue={membership.role}><option value="USER">Kullanıcı</option><option value="ADMIN">Yönetici</option></select><button className="action" type="submit">Rolü kaydet</button></form><form action={`/api/admin/workspaces/${workspace.id}/members/${membership.userId}/remove`} method="post"><input type="hidden" name="returnTo" value={returnTo}/><button className="action" type="submit">Üyeliği kaldır</button></form></div></div>)}
      </section>

      <section className="card span-5">
        <h2 style={{marginTop:0}}>30 günlük kullanım</h2>
        {operations.length === 0 ? <p className="page-subtitle">Bu dönemde API/AI kullanım kaydı yok.</p> : operations.map(([operation, item]) => <div className="row" key={operation}><div><strong style={{fontSize:13}}>{operation}</strong></div><div style={{display:'flex',gap:6}}><span className="badge">{item.count}</span>{item.failures ? <span className="badge">{item.failures} HATA</span> : null}</div></div>)}
      </section>
    </div>

    <WorkspaceInviteManager workspaces={[{ id: workspace.id, name: workspace.name }]}/>

    <section className="card" style={{marginTop:18}}>
      <h2 style={{marginTop:0}}>Davet geçmişi</h2>
      {workspace.invitations.length === 0 ? <p className="page-subtitle">Henüz davet oluşturulmamış.</p> : workspace.invitations.map((invitation) => {
        const state = invitation.acceptedAt ? 'KABUL EDİLDİ' : invitation.revokedAt ? 'İPTAL' : invitation.expiresAt.getTime() <= now ? 'SÜRESİ DOLDU' : 'BEKLİYOR';
        return <div className="row" key={invitation.id}><div><strong>{invitation.email}</strong><div style={{color:'var(--muted)',fontSize:12}}>{invitation.role} · {invitation.createdAt.toLocaleString('tr-TR')} · oluşturan {invitation.createdBy?.displayName ?? invitation.createdBy?.email ?? 'sistem'}</div></div><div style={{display:'flex',gap:8,alignItems:'center'}}><span className={`badge ${state === 'BEKLİYOR' ? 'active' : ''}`}>{state}</span>{state === 'BEKLİYOR' ? <form action={`/api/admin/invitations/${invitation.id}/revoke`} method="post"><input type="hidden" name="returnTo" value={returnTo}/><button className="action" type="submit">İptal et</button></form> : null}</div></div>;
      })}
    </section>

    <div className="grid" style={{marginTop:18}}>
      <section className="card span-6">
        <h2 style={{marginTop:0}}>Tasarlayalım AI talepleri</h2>
        {workspace.requirements.length === 0 ? <p className="page-subtitle">Bu workspace için requirement kaydı yok.</p> : workspace.requirements.map((requirement) => <div className="row" key={requirement.id}><div><strong>{requirement.title}</strong><div style={{color:'var(--muted)',fontSize:12}}>{requirement.module} · {requirement.category}</div></div><span className={`badge ${closedRequirementStatuses.has(requirement.status) ? '' : 'active'}`}>{requirement.status}</span></div>)}
      </section>

      <section className="card span-6">
        <h2 style={{marginTop:0}}>Kota kayıtları</h2>
        {quotas.length === 0 ? <p className="page-subtitle">Henüz materialize edilmiş dönem kotası yok. Paket/override limitleri kullanım başladığında backend tarafından uygulanır.</p> : quotas.map((quota) => <div className="row" key={quota.id}><div><strong>{quota.feature.label}</strong><div style={{color:'var(--muted)',fontSize:12}}>{quota.periodKey}</div></div><span className="badge">{quota.used} / {quota.limit}</span></div>)}
      </section>
    </div>

    <section className="card" style={{marginTop:18}}>
      <h2 style={{marginTop:0}}>Son yönetim hareketleri</h2>
      {audits.length === 0 ? <p className="page-subtitle">Audit kaydı yok.</p> : audits.map((audit) => <div className="row" key={audit.id}><div><strong>{audit.action}</strong><div style={{color:'var(--muted)',fontSize:12}}>{audit.entityType}{audit.entityId ? ` · ${audit.entityId}` : ''}</div></div><div style={{textAlign:'right',fontSize:12,color:'var(--muted)'}}>{audit.actor?.displayName ?? audit.actor?.email ?? 'sistem'}<br/>{audit.createdAt.toLocaleString('tr-TR')}</div></div>)}
    </section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="card" style={{padding:14}}><div style={{fontSize:21,fontWeight:750}}>{typeof value === 'number' ? value.toLocaleString('tr-TR') : value}</div><div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{label}</div></div>;
}
