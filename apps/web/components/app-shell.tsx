import Link from 'next/link';
import type { ReactNode } from 'react';

const userSections = [
  ['Üretim', [['AI Design Studio','/create/design-studio'],['Ürün Fikirleri','/create/product-intelligence']]],
  ['Çalışma Alanı', [['Projeler','/workspace/projects'],['Dosyalar','/workspace/assets']]],
  ['Commerce', [['Ürünler · Beta','/commerce/products'],['Barkodlar · Beta','/commerce/barcodes'],['Mağazalar · Preview','/commerce/stores'],['Envanter · Preview','/commerce/inventory'],['Import / Export · Beta','/commerce/import-export']]],
  ['Otomasyon', [['İş Akışları · Beta','/automation/workflows']]],
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
}: {
  children: ReactNode;
  displayName?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaces?: WorkspaceOption[];
  isSuperAdmin?: boolean;
}) {
  const sections = isSuperAdmin ? [...userSections, ...adminSections] : userSections;
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">Mağazala</div>
      <nav className="nav">{sections.map(([title,items]) => <div key={title}>
        <div className="nav-title">{title}</div>
        {items.map(([label,href]) => <Link key={label} href={href}>{label}</Link>)}
      </div>)}</nav>
    </aside>
    <main className="main">
      <header className="topbar" style={{gap:12,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          {workspaces.length > 1 ? <form action="/api/workspace/switch" method="post" style={{display:'flex',gap:7,alignItems:'center'}}>
            <select className="input" name="workspaceId" defaultValue={workspaceId} aria-label="Aktif çalışma alanı" style={{minWidth:180,padding:'7px 10px'}}>{workspaces.map((workspace)=><option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}</select>
            <button className="action" type="submit">Geç</button>
          </form> : <strong>{workspaceName ?? 'Çalışma Alanı'}</strong>}
          {displayName ? <span style={{color:'var(--muted)',fontSize:13}}>{displayName}</span> : null}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span className="badge active">ACTIVE CORE</span>
          <form action="/api/auth/logout" method="post"><button className="action" type="submit">Çıkış</button></form>
        </div>
      </header>
      {children}
    </main>
  </div>;
}
