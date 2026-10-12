import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export default async function UsersAdminPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      memberships: {
        include: { workspace: { include: { package: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return <div className="content">
    <h1 className="page-title">Kullanıcılar</h1>
    <p className="page-subtitle">Kullanıcılar ve workspace üyelikleri gerçek hesap kayıtlarından gösterilir. Paket erişimi workspace üzerinden, özellik izinleri paket ve workspace override katmanlarıyla uygulanır.</p>

    {users.length === 0 ? <section className="card" style={{marginTop:24}}><div className="empty"><div><strong>Kullanıcı kaydı yok</strong><br/><span>İlk güvenli kurulum tamamlandığında yönetici hesabı burada görünür.</span></div></div></section> : <section className="card" style={{marginTop:24}}>
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

    <section className="card" style={{marginTop:18}}>
      <h3>Yeni kullanıcı erişimi</h3>
      <p className="page-subtitle">Yeni kullanıcı oluşturma, adminin kullanıcı adına parola belirlediği bir form olarak eklenmeyecek. Tek kullanımlık ve süreli davet akışı schema migration ile birlikte devreye alınacaktır.</p>
    </section>
  </div>;
}
