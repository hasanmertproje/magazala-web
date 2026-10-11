import Link from 'next/link';

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

export function AppShell({
  children,
  displayName,
  workspaceName,
  isSuperAdmin = false,
}: {
  children: React.ReactNode;
  displayName?: string;
  workspaceName?: string;
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
      <header className="topbar">
        <div><strong>{workspaceName ?? 'Çalışma Alanı'}</strong>{displayName ? <span style={{color:'var(--muted)',marginLeft:10,fontSize:13}}>{displayName}</span> : null}</div>
        <span className="badge active">ACTIVE CORE</span>
      </header>
      {children}
    </main>
  </div>;
}
