'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

const sections = [
  { title: 'Platform', links: [
    ['Müşteriler', '/admin/workspaces'], ['Kullanıcılar', '/admin/users'], ['Paketler ve Krediler', '/admin/packages'],
  ] },
  { title: 'Sağlayıcı Yönetimi', links: [
    ['Model Sağlayıcıları', '/admin/providers'], ['Modeller', '/admin/models'], ['Model Yönlendirme', '/admin/router'],
  ] },
  { title: 'Sistem', links: [
    ['Geliştirme Talepleri', '/admin/requirements'], ['Sistem Durumu', '/admin/system'],
  ] },
] as const;

export function AdminShell({ children, displayName, unreadNotifications = 0 }: {
  children: ReactNode; displayName: string; unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  return <div className="shell">
    {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Yönetim menüsünü kapat" onClick={() => setMobileOpen(false)} />}
    <aside className={'sidebar' + (mobileOpen ? ' sidebar-open' : '')} id="admin-navigation" aria-label="Yönetici menüsü">
      <div className="sidebar-heading">
        <Link href="/dashboard" className="brand brand-lockup" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark" aria-hidden="true">EP</span><span className="brand-wordmark">EntegrePilot<small>Yönetici Konsolu</small></span>
        </Link>
        <button type="button" className="sidebar-close action" aria-label="Menüyü kapat" onClick={() => setMobileOpen(false)}>✕</button>
      </div>
      <nav className="nav">
        <div className="nav-overview">PLATFORM YÖNETİMİ</div>
        {sections.map((section, i) => <div className="nav-section" key={section.title}>
          <div className="nav-title"><span>{String(i + 1).padStart(2, '0')}</span>{section.title}</div>
          {section.links.map(([label, href]) =>
            <Link key={href} href={href} className={'nav-link' + (pathname === href ? ' is-current' : '')}
              aria-current={pathname === href ? 'page' : undefined} onClick={() => setMobileOpen(false)}>
              <span className="nav-link-indicator" aria-hidden="true"/>{label}
            </Link>)}
        </div>)}
        <div className="nav-section"><div className="nav-title">Çalışma Alanı</div>
          <Link href="/dashboard" className="nav-link" onClick={() => setMobileOpen(false)}><span className="nav-link-indicator"/>Kullanıcı paneline dön</Link>
        </div>
      </nav>
      <div className="sidebar-footer"><span className="workspace-status-dot"/> Yönetici oturumu <small>EntegrePilot Platform</small></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button type="button" className="mobile-menu-toggle action" aria-controls="admin-navigation"
          aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Yönetim menüsünü kapat' : 'Yönetim menüsünü aç'}
          onClick={() => setMobileOpen(v => !v)}>☰ Menü</button>
        <div className="topbar-context"><span className="topbar-section">EntegrePilot</span><span className="topbar-divider">/</span><strong>Yönetim</strong></div>
        <div className="topbar-actions">
          <Link className="topbar-notifications" href="/notifications">Bildirimler{unreadNotifications>0 ? ' ('+unreadNotifications+')' : ''}</Link>
          <span className="topbar-user">{displayName}</span>
          <form action="/api/auth/logout" method="post"><button className="action topbar-signout" type="submit">Oturumu kapat</button></form>
        </div>
      </header>
      {children}
    </main>
  </div>;
}
