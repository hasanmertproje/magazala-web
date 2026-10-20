'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMobileSidebar } from './use-mobile-sidebar';
import { navigationForPanel } from '../lib/panel-navigation';

export function AdminShell({ children, displayName, unreadNotifications = 0 }: {
  children: ReactNode; displayName: string; unreadNotifications?: number;
}) {
  const pathname = usePathname();
  const sections = navigationForPanel('admin');
  const { open: mobileOpen, setOpen: setMobileOpen, panelRef, triggerRef } = useMobileSidebar(pathname);

  return <div className="shell" data-panel="admin">
    {mobileOpen && <button type="button" className="sidebar-backdrop" aria-label="Yönetim menüsünü kapat" onClick={() => setMobileOpen(false)} />}
    <aside ref={panelRef} className={'sidebar' + (mobileOpen ? ' sidebar-open' : '')} id="admin-navigation" aria-label="Yönetici menüsü">
      <div className="sidebar-heading">
        <Link href="/admin/workspaces" className="brand brand-lockup" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark" aria-hidden="true">EP</span><span className="brand-wordmark">EntegrePilot<small>Yönetici Konsolu</small></span>
        </Link>
        <button type="button" className="sidebar-close action" aria-label="Menüyü kapat" onClick={() => setMobileOpen(false)}>✕</button>
      </div>
      <nav className="nav">
        <div className="nav-overview">PLATFORM YÖNETİMİ</div>
        {sections.map(([title, links], i) => <div className="nav-section" key={title}>
          <div className="nav-title"><span>{String(i + 1).padStart(2, '0')}</span>{title}</div>
          {links.map(([label, href]) =>
            <Link key={href} href={href} className={'nav-link' + (pathname === href ? ' is-current' : '')}
              aria-current={pathname === href ? 'page' : undefined} onClick={() => setMobileOpen(false)}>
              <span className="nav-link-indicator" aria-hidden="true"/>{label}
            </Link>)}
        </div>)}
      </nav>
      <div className="sidebar-footer"><span className="workspace-status-dot"/> Yönetici oturumu <small>EntegrePilot Platform</small><a className="panel-switch-link" href="/dashboard">Çalışma alanına geç ↗</a></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button ref={triggerRef} type="button" className="mobile-menu-toggle action" aria-controls="admin-navigation"
          aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Yönetim menüsünü kapat' : 'Yönetim menüsünü aç'}
          onClick={() => setMobileOpen(v => !v)}>☰ Menü</button>
        <div className="topbar-context"><span className="topbar-section">EntegrePilot</span><span className="topbar-divider">/</span><strong>Yönetim</strong></div>
        <div className="topbar-actions">
          <a className="topbar-notifications" href="/notifications">Çalışma alanı bildirimleri{unreadNotifications>0 ? ' ('+unreadNotifications+')' : ''}</a>
          <span className="topbar-user">{displayName}</span>
          <form action="/api/auth/logout" method="post"><button className="action topbar-signout" type="submit">Oturumu kapat</button></form>
        </div>
      </header>
      {children}
    </main>
  </div>;
}
