import Link from 'next/link';
import { requireUserPage } from '../../../lib/auth';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function destination(type: string) {
  if (type === 'REQUIREMENT_CONFIRMED' || type === 'REQUIREMENT_CLARIFICATION_ANSWERED') return '/admin/requirements';
  if (type === 'REQUIREMENT_STATUS_CHANGED' || type === 'REQUIREMENT_CLARIFICATION_REQUESTED') return '/help/features';
  return null;
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ notice?:string; error?:string }> }) {
  const context = await requireUserPage();
  const query = await searchParams;
  const notifications = await db.notification.findMany({ where: { userId: context.user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  const unread = notifications.filter((item) => !item.readAt).length;

  return <div className="content">
    <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><h1 className="page-title">Bildirimler</h1><p className="page-subtitle">Hesabınıza gönderilen sistem ve özellik talebi bildirimleri.</p></div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}><span className={`badge ${unread?'active':''}`}>{unread} OKUNMAMIŞ</span>{unread?<form action="/api/notifications/read-all" method="post"><button className="action" type="submit">Tümünü okundu yap</button></form>:null}</div>
    </div>
    {query.notice?<section className="card" style={{marginTop:14}}>Bildirim durumu güncellendi.</section>:null}
    {query.error?<section className="card" style={{marginTop:14,color:'var(--danger)'}}>Bildirim durumu güncellenemedi: {query.error}</section>:null}
    <div style={{display:'grid',gap:10,marginTop:18}}>{notifications.length===0?<section className="card"><div className="empty"><div><strong>Bildirim yok</strong><br/><span>Önemli hesap ve özellik talebi güncellemeleri burada görünür.</span></div></div></section>:notifications.map((notification)=>{
      const href=destination(notification.type);
      return <section className="card" key={notification.id} style={{opacity:notification.readAt ? 0.75 : 1}}><div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}><div style={{minWidth:0,flex:'1 1 420px'}}><div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><span className={`badge ${notification.readAt?'':'active'}`}>{notification.readAt?'OKUNDU':'YENİ'}</span><span style={{fontSize:11,color:'var(--muted)'}}>{notification.type}</span></div><h2 style={{fontSize:17,margin:'9px 0 5px'}}>{notification.title}</h2><p style={{margin:0,lineHeight:1.6,color:'var(--muted)'}}>{notification.body}</p><div style={{fontSize:11,color:'var(--muted)',marginTop:8}}>{notification.createdAt.toLocaleString('tr-TR')}</div></div><div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{href?<Link className="action primary" href={href}>İlgili alanı aç</Link>:null}{!notification.readAt?<form action={`/api/notifications/${notification.id}/read`} method="post"><button className="action" type="submit">Okundu yap</button></form>:null}</div></div></section>;
    })}</div>
  </div>;
}
