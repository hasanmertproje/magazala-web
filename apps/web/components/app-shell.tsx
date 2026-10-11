import Link from 'next/link';

const sections = [
  ['Üretim', [['AI Design Studio','/create/design-studio'],['Ürün Fikirleri','/create/product-intelligence']]],
  ['Çalışma Alanı', [['Projeler','/'],['Dosyalar','/']]],
  ['Commerce', [['Ürünler · Beta','/'],['Barkodlar · Beta','/'],['Mağazalar · Preview','/']]],
  ['Yardım & Keşif', [['Özellikler Hakkında Konuş','/help/features'],['Bilgilendirme','/help/info']]],
  ['Yönetim', [['API Sağlayıcıları','/admin/providers'],['Tasarlayalım AI Talepleri','/admin/requirements']]],
] as const;

export function AppShell({children}:{children:React.ReactNode}){
  return <div className="shell"><aside className="sidebar"><div className="brand">Mağazala</div><nav className="nav">{sections.map(([title,items])=><div key={title}><div className="nav-title">{title}</div>{items.map(([label,href])=><Link key={label} href={href}>{label}</Link>)}</div>)}</nav></aside><main className="main"><header className="topbar"><strong>Çalışma Alanı</strong><span className="badge active">ACTIVE CORE</span></header>{children}</main></div>
}
