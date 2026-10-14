'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const userSections = [
  ['Üretim', [['AI Design Studio','/create/design-studio'],['Ürün Fikirleri','/create/product-intelligence']]],
  ['Çalışma Alanı', [['Projeler','/workspace/projects'],['Dosyalar','/workspace/assets']]],
  ['Commerce', [['Ürünler · Beta','/commerce/products'],['Barkodlar · Beta','/commerce/barcodes'],['Mağazalar · Preview','/commerce/stores'],['Envanter · Preview','/commerce/inventory'],['Import / Export · Beta','/commerce/import-export']]],
  ['Otomasyon', [['İş Akışları · Beta','/automation/workflows']]],
  ['Hesap', [['Bildirimler','/notifications']]],
  ['Yardım & Keşif', [['Özellikler Hakkında Konuş','/help/features'],['Bilgilendirme','/help/info']]],
] as const;

const adminSections = [
  ['Yönetim', [['API Sağlayıcıları','/admin/providers'],['Modeller','/admin/models'],['Router','/admin/router'],['Kullanıcılar','/admin/users'],['Paketler','/admin/packages'],['Tasarlayalım AI Talepleri','/admin/requirements'],['Sistem','/admin/system']]],
] as const;

type WorkspaceOption = { id: string; name: string };

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
  const sections = isSuperAdmin ? [...userSections, ...adminSections] : userSections;
  return <div className="shell">
    {mobileMenuOpen && <button type="button" className="sidebar-backdrop" aria-label="Menüyü kapat" onClick={() => setMobileMenuOpen(false)} />}

    <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`} id="main-navigation" aria-label="Ana menü">
      <div className="sidebar-heading"><div className="brand">EntegrePilot</div><button type="button" className="sidebar-close action" onClick={() => setMobileMenuOpen(false)} aria-label="Menüyü kapat">✕</button></div>
      <nav className="nav">{sections.map(([title,items]) => <div key={title}>
        <div className="nav-title">{title}</div>
        {items.map(([label,href]) => <Link key={label} href={href} onClick={() => setMobileMenuOpen(false)}>{label}{href==='/notifications'&&unreadNotifications>0?<span className="badge active" style={{marginLeft:7}}>{unreadNotifications}</span>:null}</Link>)}
      </div>)}</nav>
    </aside>
    <main className="main">
      <header className="topbar" style={{gap:12,flexWrap:'wrap'}}>
        <button type="button" className="mobile-menu-toggle action" aria-label={mobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"} aria-controls="main-navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((current) => !current)}>☰ <span>Menü</span></button>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          {workspaces.length > 1 ? <form action="/api/workspace/switch" method="post" style={{display:'flex',gap:7,alignItems:'center'}}>
            <select className="input" name="workspaceId" defaultValue={workspaceId} aria-label="Aktif çalışma alanı" style={{minWidth:180,padding:'7px 10px'}}>{workspaces.map((workspace)=><option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}</select>
            <button className="action" type="submit">Geç</button>
          </form> : <strong>{workspaceName ?? 'Çalışma Alanı'}</strong>}
          {displayName ? <span style={{color:'var(--muted)',fontSize:13}}>{displayName}</span> : null}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Link className="action" href="/notifications">Bildirimler{unreadNotifications>0?` (${unreadNotifications})`:''}</Link>
          <span className="badge active">ACTIVE CORE</span>
          <form action="/api/auth/logout" method="post"><button className="action" type="submit">Çıkış</button></form>
        </div>
      </header>
      {children}
    </main>
  </div>;
}
