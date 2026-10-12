import { WorkspaceInviteManager } from '../../../components/workspace-invite-manager';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function invitationStatus(invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }) {
  if (invitation.acceptedAt) return 'KABUL EDİLDİ';
  if (invitation.revokedAt) return 'İPTAL EDİLDİ';
  if (invitation.expiresAt.getTime() <= Date.now()) return 'SÜRESİ DOLDU';
  return 'BEKLİYOR';
}

export default async function UsersAdminPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const params = await searchParams;
  const [users, workspaces, invitations] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          include: { workspace: { include: { package: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    db.workspace.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.workspaceInvitation.findMany({
      include: { workspace: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  return <div className="content">
    <h1 className="page-title">Kullanıcılar & Davetler</h1>
    <p className="page-subtitle">Kullanıcı hesapları, workspace üyelikleri ve süreli davetler gerçek kayıtlardan gösterilir. Paket erişimi workspace üzerinden, özellik izinleri paket ve workspace override katmanlarıyla uygulanır.</p>
    {params.notice ? <section className="card" style={{marginTop:16}}>İşlem tamamlandı.</section> : null}
    {params.error ? <section className="card" style={{marginTop:16,color:'var(--danger)'}}>İşlem tamamlanamadı: {params.error}</section> : null}

    <WorkspaceInviteManager workspaces={workspaces}/>

    <section className="card" style={{marginTop:18}}>
      <h3>Son davetler</h3>
      <p className="page-subtitle">Raw davet tokenları saklanmaz ve bu listede yeniden gösterilemez. Bağlantı kaybolursa bekleyen daveti iptal edip yenisini oluşturun.</p>
      {invitations.length === 0 ? <div className="empty"><div><strong>Davet kaydı yok</strong><br/><span>Yeni kullanıcı erişimini yukarıdaki formdan başlatabilirsiniz.</span></div></div> : invitations.map((invitation) => {
        const status = invitationStatus(invitation);
        const pending = status === 'BEKLİYOR';
        return <div className="row" key={invitation.id} style={{alignItems:'flex-start'}}>
          <div><strong>{invitation.email}</strong><div style={{color:'var(--muted)',fontSize:12,marginTop:4}}>{invitation.workspace.name} · {invitation.role} · oluşturuldu {invitation.createdAt.toLocaleString('tr-TR')} · son kullanım {invitation.expiresAt.toLocaleString('tr-TR')}</div></div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}><span className={`badge ${pending?'active':''}`}>{status}</span>{pending ? <form action={`/api/admin/invitations/${invitation.id}/revoke`} method="post"><button className="action" type="submit">İptal et</button></form> : null}</div>
        </div>;
      })}
    </section>

    {users.length === 0 ? <section className="card" style={{marginTop:18}}><div className="empty"><div><strong>Kullanıcı kaydı yok</strong><br/><span>İlk güvenli kurulum tamamlandığında yönetici hesabı burada görünür.</span></div></div></section> : <section className="card" style={{marginTop:18}}>
      <h3>Hesaplar ve üyelikler</h3>
      {users.map((user) => <div key={user.id} style={{padding:'16px 0',borderBottom:'1px solid var(--line)'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div>
            <strong>{user.displayName || user.email}</strong>
            <div style={{color:'var(--muted)',fontSize:13,marginTop:4}}>{user.email}</div>
            <div style={{color:'var(--muted)',fontSize:12,marginTop:4}}>Oluşturulma: {user.createdAt.toISOString().replace('T',' ').slice(0,16)}</div>
          </div>
          <span className={`badge ${user.isSuperAdmin?'active':''}`}>{user.isSuperAdmin?'SUPER ADMIN':'USER'}</span>
        </div>
        <div style={{display:'grid',gap:8,marginTop:12}}>
          {user.memberships.length === 0 ? <div style={{color:'var(--muted)',fontSize:13}}>Workspace üyeliği bulunmuyor.</div> : user.memberships.map((membership) => <div className="row" key={`${membership.workspaceId}:${membership.userId}`}>
            <div><strong>{membership.workspace.name}</strong><div style={{color:'var(--muted)',fontSize:12}}>{membership.workspace.slug}</div></div>
            <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><span className="badge">{membership.role}</span><span className="badge">{membership.workspace.package?.name ?? 'PAKET YOK'}</span></div>
          </div>)}
        </div>
      </div>)}
    </section>}
  </div>;
}
