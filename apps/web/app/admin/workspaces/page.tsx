import Link from 'next/link';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export default async function WorkspacesAdminPage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [workspaces, usage] = await Promise.all([
    db.workspace.findMany({
      include: {
        package: true,
        invitations: {
          where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true },
        },
        _count: { select: { members: true, products: true, requirements: true, connectors: true, projects: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.usageLedger.groupBy({
      by: ['workspaceId'],
      where: { startedAt: { gte: since } },
      _count: { id: true },
    }),
  ]);

  const usageByWorkspace = new Map(usage.map((row) => [row.workspaceId, row._count.id]));

  return <div className="content">
    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><h1 className="page-title">Müşteriler</h1><p className="page-subtitle">Her çalışma alanını paket, kullanıcı, modül, kota, AI kullanımı ve operasyon kayıtlarıyla tek müşteri hesabı olarak yönetin.</p></div>
      <Link className="action" href="/admin/users">Kullanıcı & davet yönetimi</Link>
    </div>

    {workspaces.length === 0 ? <section className="card" style={{marginTop:22}}><div className="empty"><div><strong>Çalışma alanı bulunmuyor</strong><br/><span>İlk güvenli kurulum tamamlandığında ilk çalışma alanı burada görünür.</span></div></div></section> : <div style={{display:'grid',gap:14,marginTop:22}}>
      {workspaces.map((workspace) => <Link href={`/admin/workspaces/${workspace.id}`} className="card" key={workspace.id} style={{display:'block',textDecoration:'none',color:'inherit'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div><h2 style={{margin:'0 0 5px',fontSize:19}}>{workspace.name}</h2><div style={{color:'var(--muted)',fontSize:12}}>{workspace.slug} · oluşturulma {workspace.createdAt.toLocaleDateString('tr-TR')}</div></div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><span className={`badge ${workspace.package ? 'active' : ''}`}>{workspace.package?.name ?? 'PAKET YOK'}</span>{workspace.invitations.length ? <span className="badge">{workspace.invitations.length} BEKLEYEN DAVET</span> : null}</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(125px,1fr))',gap:10,marginTop:16}}>
          <Metric label="Üye" value={workspace._count.members}/><Metric label="Ürün" value={workspace._count.products}/><Metric label="Proje" value={workspace._count.projects}/><Metric label="Mağaza" value={workspace._count.connectors}/><Metric label="AI talebi" value={workspace._count.requirements}/><Metric label="30g API/AI çağrısı" value={usageByWorkspace.get(workspace.id) ?? 0}/>
        </div>
      </Link>)}
    </div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div style={{padding:12,border:'1px solid var(--line)',borderRadius:12}}><div style={{fontSize:20,fontWeight:750}}>{value.toLocaleString('tr-TR')}</div><div style={{color:'var(--muted)',fontSize:11,marginTop:3}}>{label}</div></div>;
}
