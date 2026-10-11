import Link from 'next/link';
import type { ReactNode } from 'react';

const groups = [
  { label: 'Oluştur', items: [
    ['AI Design Studio', '/create/design-studio', 'ACTIVE'],
    ['Product Intelligence', '/create/product-intelligence', 'ACTIVE'],
  ]},
  { label: 'Çalışma Alanı', items: [
    ['Projeler', '/workspace/projects', 'ACTIVE'],
    ['Dosyalar', '/workspace/assets', 'ACTIVE'],
  ]},
  { label: 'Commerce', items: [
    ['Ürünler', '/commerce/products', 'BETA'],
    ['Barkodlar', '/commerce/barcodes', 'BETA'],
    ['Mağazalar', '/commerce/stores', 'PREVIEW'],
    ['Stok', '/commerce/inventory', 'PREVIEW'],
    ['İçe / Dışa Aktar', '/commerce/import-export', 'BETA'],
  ]},
  { label: 'Otomasyon', items: [['İş Akışları', '/automation/workflows', 'BETA']]},
  { label: 'Yardım & Keşif', items: [
    ['Özellikler Hakkında Konuş', '/help/features', 'ACTIVE'],
    ['Bilgilendirme', '/help/info', 'ACTIVE'],
  ]},
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">Magazala</div>
      {groups.map((group) => <div className="nav-group" key={group.label}>
        <div className="nav-label">{group.label}</div>
        {group.items.map(([name, href, status]) => <Link className="nav-item" href={href} key={href}>
          <span>{name}</span><span className={`badge ${status.toLowerCase()}`}>{status}</span>
        </Link>)}
      </div>)}
      <div className="nav-group"><div className="nav-label">Yönetim</div><Link className="nav-item" href="/admin/providers"><span>Admin Paneli</span></Link></div>
    </aside>
    <main className="main"><div className="topbar"><strong>Çalışma Alanı</strong><span className="badge active">ACTIVE</span></div>{children}</main>
  </div>;
}
