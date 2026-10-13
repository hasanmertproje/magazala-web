import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { getAuthContext } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const installed = (await db.user.count()) > 0;
  const auth = installed ? await getAuthContext() : null;
  if (installed && !auth) redirect('/login');
  if (installed && !auth?.user.isSuperAdmin) redirect('/');

  const { error } = await searchParams;
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}>
    <section className="card" style={{width:'min(520px,100%)'}}>
      <div className="brand" style={{marginBottom:24}}>Magazala</div>
      <h1 className="page-title">{installed ? 'Yeni çalışma alanı kurulumu' : 'İlk yönetici kurulumu'}</h1>
      <p className="page-subtitle">{installed
        ? 'Mevcut veriler ve hesaplar korunur. Süper yönetici olarak yeni bir çalışma alanı oluşturabilirsiniz.'
        : 'İlk yönetici hesabı ve çalışma alanı oluşturulur. Varsayılan parola tanımlanmaz.'}</p>
      {error && <p role="alert" style={{marginTop:14}}>Kurulum tamamlanamadı. Bilgileri ve yetkilerinizi kontrol edin.</p>}
      <form action="/api/auth/setup" method="post" style={{display:'grid',gap:12,marginTop:22}}>
        {!installed && <>
          <label>Adınız<input className="input" name="displayName" autoComplete="name" required minLength={2} /></label>
          <label>E-posta<input className="input" name="email" type="email" autoComplete="email" required /></label>
          <label>Parola<input className="input" name="password" type="password" autoComplete="new-password" required minLength={12} /></label>
        </>}
        <label>Çalışma alanı adı<input className="input" name="workspaceName" required minLength={2} maxLength={100} /></label>
        <button className="action primary" type="submit">{installed ? 'Yeni çalışma alanı oluştur' : 'Kurulumu tamamla'}</button>
      </form>
    </section>
  </main>;
}
