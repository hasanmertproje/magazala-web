import { redirect } from 'next/navigation';
import { db } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await db.user.count()) redirect('/login');
  const { error } = await searchParams;
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}><section className="card" style={{width:'min(520px,100%)'}}><div className="brand" style={{marginBottom:24}}>Magazala</div><h1 className="page-title">İlk yönetici kurulumu</h1><p className="page-subtitle">İlk yönetici hesabı ve çalışma alanı bir kez oluşturulur. Varsayılan parola tanımlanmaz.</p>{error && <p style={{marginTop:14}}>Kurulum tamamlanamadı. Bilgileri ve sunucu yapılandırmasını kontrol edin.</p>}<form action="/api/auth/setup" method="post" style={{display:'grid',gap:12,marginTop:22}}><label>Adınız<input className="input" name="displayName" autoComplete="name" required minLength={2} /></label><label>E-posta<input className="input" name="email" type="email" autoComplete="email" required /></label><label>Parola<input className="input" name="password" type="password" autoComplete="new-password" required minLength={12} /></label><label>Çalışma alanı adı<input className="input" name="workspaceName" required minLength={2} /></label><button className="action primary" type="submit">Kurulumu tamamla</button></form></section></main>;
}
