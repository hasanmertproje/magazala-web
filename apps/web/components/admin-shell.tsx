import Link from 'next/link';
import type { ReactNode } from 'react';

const items = [
  ['Müşteriler', '/admin/workspaces'], ['Kullanıcılar', '/admin/users'], ['Paketler', '/admin/packages'], ['Provider Center', '/admin/providers'],
  ['Modeller', '/admin/models'], ['Router', '/admin/router'], ['Tasarlayalım AI Talepleri', '/admin/requirements'], ['Sistem', '/admin/system'],
] as const;

export function AdminShell({ children, displayName, unreadNotifications = 0 }: { children: ReactNode; displayName: string; unreadNotifications?: number }) {
  return <div className="shell"><aside className="sidebar"><Link href="/" className="brand">Magazala</Link><div className="nav-group"><div className="nav-label">Yönetim</div>{items.map(([name, href]) => <Link className="nav-item" href={href} key={href}>{name}</Link>)}</div><div className="nav-group"><Link className="nav-item" href="/notifications">Bildirimler{unreadNotifications>0?<span className="badge active" style={{marginLeft:7}}>{unreadNotifications}</span>:null}</Link><Link className="nav-item" href="/">Kullanıcı paneline dön</Link></div></aside><main className="main"><div className="topbar"><strong>Admin</strong><div style={{display:'flex',gap:8,alignItems:'center'}}><Link className="action" href="/notifications">Bildirimler{unreadNotifications>0?` (${unreadNotifications})`:''}</Link><span style={{color:'var(--muted)',fontSize:12}}>{displayName}</span></div></div>{children}</main></div>;
}
