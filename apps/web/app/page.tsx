import Link from 'next/link';
import { AuthenticatedShell } from '../components/authenticated-shell';

export default function HomePage() {
  return <AuthenticatedShell><div className="content">
    <section className="card hero span-12">
      <span className="badge active" style={{width:'fit-content'}}>ACTIVE</span>
      <h1 className="page-title" style={{marginTop:12}}>Üretimden operasyona tek çalışma alanı.</h1>
      <p className="page-subtitle">Tasarım üretin, ürün fikirlerini araştırın ve büyüyen commerce operasyonunuzu aynı modüler sistem üzerinden yönetin.</p>
      <div style={{display:'flex',gap:10,marginTop:18}}><Link className="action primary" href="/create/design-studio">Tasarım oluştur</Link><Link className="action" href="/create/product-intelligence">Ürün fikri araştır</Link></div>
    </section>
    <div className="grid">
      <section className="card span-4"><h3>AI Design Studio</h3><p>Referanslarla, üretim amacı ve çıktı gereksinimleriyle kontrollü görsel üretim alanı.</p></section>
      <section className="card span-4"><h3>Product Intelligence</h3><p>Fikir üretimini kaynaklı pazar araştırmasından ayıran ürün keşif alanı.</p></section>
      <section className="card span-4"><h3>Commerce</h3><p>Ürün, barkod ve mağaza entegrasyonları kontrollü Beta/Preview sınırlarında geliştirilir.</p></section>
    </div>
  </div></AuthenticatedShell>;
}
