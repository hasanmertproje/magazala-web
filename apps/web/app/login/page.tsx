import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthContext } from '../../lib/auth';

export const dynamic = 'force-dynamic';

function safeNext(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return '/';
  return value;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getAuthContext()) redirect(next);
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}><section className="card" style={{width:'min(440px,100%)'}}><div className="brand" style={{marginBottom:24}}>Magazala</div><h1 className="page-title">Giriş yap</h1><p className="page-subtitle">Çalışma alanınıza güvenli şekilde erişin.</p>{params.error && <p style={{marginTop:14}}>Giriş bilgileri doğrulanamadı.</p>}<form action="/api/auth/login" method="post" style={{display:'grid',gap:12,marginTop:22}}>{next !== '/' ? <input type="hidden" name="next" value={next}/> : null}<label>E-posta<input className="input" name="email" type="email" autoComplete="email" required /></label><label>Parola<input className="input" name="password" type="password" autoComplete="current-password" required /></label><button className="action primary" type="submit">Giriş yap</button></form><p style={{marginTop:18,color:'var(--muted)',fontSize:13}}>Platform ilk kez kuruluyorsa <Link href="/setup">güvenli kurulumu başlatın</Link>.</p></section></main>;
}
