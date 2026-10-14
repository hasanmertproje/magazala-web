'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const userSections = [
  ['Genel', [['Kontrol Paneli','/dashboard']]],
  ['Mağaza Yönetimi', [['Mağazalar ve Entegrasyonlar','/commerce/stores'],['Ürün Kataloğu','/commerce/products'],['Stok ve Depo','/commerce/inventory'],['Barkod ve SKU','/commerce/barcodes'],['Veri Aktarımı','/commerce/import-export']]],
  ['Operasyon', [['İş Akışları','/automation/workflows'],['Projeler','/workspace/projects'],['Dosyalar','/workspace/assets']]],
  ['Eklentiler', [['Görsel Stüdyosu','/create/design-studio'],['Ürün Araştırması','/create/product-intelligence']]],
  ['Hesap ve Destek', [['Bildirimler','/notifications'],['Paketim ve Kredilerim','/billing'],['Yardım','/help/info']]],
] as const;

const adminSections = [
  ['Yönetim', [['API Sağlayıcıları','/admin/providers'],['Modeller','/admin/models'],['Router','/admin/router'],['Kullanıcılar','/admin/users'],['Paketler','/admin/packages'],['Geliştirme Talepleri','/admin/requirements'],['Sistem','/admin/system']]],
] as const;

type WorkspaceOption = { id: string; name: string };

function sectionsLabel(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return 'Genel';
  if (pathname.startsWith('/create/')) return 'Eklentiler';
  if (pathname.startsWith('/commerce/')) return 'Mağaza Yönetimi';
  if (pathname.startsWith('/workspace/')) return 'Çalışma Alanı';
  if (pathname.startsWith('/automation/')) return 'Operasyon';
  if (pathname.startsWith('/admin/')) return 'Yönetim';
  return 'Genel';
}

export function AppShell({
  children,
  displayName,
  workspaceId,
  workspaceName,
  workspaces = [],
  isSuperAdmin = false,
  unreadNotifications = 0,
}: {
  children: ReactNode;
  displayName?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaces?: WorkspaceOption[];
  isSuperAdmin?: boolean;
  unreadNotifications?: number;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { setMobileMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);
  const sectionLabel = sectionsLabel(pathname);
  const sections = isSuperAdmin ? [...userSections, ...adminSections] : userSections;
  return <div className="shell">
    {mobileMenuOpen && <button type="button" className="sidebar-backdrop" aria-label="Menüyü kapat" onClick={() => setMobileMenuOpen(false)} />}

    <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`} id="main-navigation" aria-label="Ana menü">
      <div className="sidebar-heading"><Link href="/dashboard" className="brand brand-lockup"><span className="brand-mark" aria-hidden="true">EP</span><span className="brand-wordmark">EntegrePilot<small>Commerce Workspace</small></span></Link><button type="button" className="sidebar-close action" onClick={() => setMobileMenuOpen(false)} aria-label="Menüyü kapat">✕</button></div>
      <nav className="nav"><div className="nav-overview">ÇALIŞMA ALANI</div>{sections.map(([title,items], sectionIndex) => <div key={title} className="nav-section">
        <div className="nav-title"><span>{String(sectionIndex + 1).padStart(2, "0")}</span>{title}</div>
        {items.map(([label,href]) => <Link key={label} href={href} aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "nav-link is-current" : "nav-link"} onClick={() => setMobileMenuOpen(false)}><span className="nav-link-indicator" aria-hidden="true" />{label}{href==='/notifications'&&unreadNotifications>0?<span className="badge active" style={{marginLeft:7}}>{unreadNotifications}</span>:null}</Link>)}
      </div>)}</nav><div className="sidebar-footer"><span className="workspace-status-dot" /> Platform erişilebilir <small>EntegrePilot Yönetim Paneli</small></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button type="button" className="mobile-menu-toggle action" aria-label={mobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"} aria-controls="main-navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((current) => !current)}><span aria-hidden="true">☰</span> <span>Menü</span></button>
        <div className="topbar-context"><span className="topbar-section">{sectionLabel}</span><span className="topbar-divider">/</span>
          {workspaces.length > 1 ? <form action="/api/workspace/switch" method="post" style={{display:'flex',gap:7,alignItems:'center'}}>
            <select className="input" name="workspaceId" defaultValue={workspaceId} aria-label="Aktif çalışma alanı" style={{minWidth:180,padding:'7px 10px'}}>{workspaces.map((workspace)=><option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}</select>
            <button className="action" type="submit">Geç</button>
          </form> : <strong>{workspaceName ?? 'Çalışma Alanı'}</strong>}
          {displayName ? <span style={{color:'var(--muted)',fontSize:13}}>{displayName}</span> : null}
        </div>
        <div className="topbar-actions">
          <Link className="topbar-notifications" href="/notifications" aria-label="Bildirimler">Bildirimler{unreadNotifications>0?` (${unreadNotifications})`:''}</Link>
          <form action="/api/auth/logout" method="post"><button className="action topbar-signout" type="submit">Oturumu kapat</button></form>
        </div>
      </header>
      {children}
    </main>
  </div>;
}
