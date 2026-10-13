'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

export default function RecoverPage() {
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          token: form.get('token'),
        }),
      });
      const data = await response.json() as { ok?: boolean; code?: string };
      if (!response.ok || !data.ok) throw new Error(data.code ?? 'RECOVERY_FAILED');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RECOVERY_FAILED');
    } finally {
      setSaving(false);
    }
  }

  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}>
    <section className="card" style={{width:'min(520px,100%)'}}>
      <div className="brand" style={{marginBottom:24}}>Magazala</div>
      <h1 className="page-title">Yönetici hesabı kurtarma</h1>
      {done ? <><p role="status">Parola güncellendi. Eski oturumlar iptal edildi.</p><Link href="/login" className="action primary">Giriş yap</Link></> :
      <>
        <p className="page-subtitle">Bu ekran yalnızca süreli yönetici kurtarma anahtarı etkinleştirildiğinde kullanılabilir. Mevcut verileri silmez.</p>
        {error && <p role="alert" style={{color:'#ff9b9b'}}>{error === 'RECOVERY_NOT_AUTHORIZED' ? 'Anahtar geçersiz, süresi dolmuş ya da yönetici e-postası eşleşmiyor.' : error === 'RECOVERY_TOKEN_USED' ? 'Bu anahtar daha önce kullanılmış.' : 'Kurtarma işlemi tamamlanamadı.'}</p>}
        <form onSubmit={submit} style={{display:'grid',gap:12,marginTop:22}}>
          <label>Yönetici e-postası<input className="input" name="email" type="email" autoComplete="email" required /></label>
          <label>Tek kullanımlık kurtarma anahtarı<input className="input" name="token" type="password" required minLength={32} autoComplete="off" /></label>
          <label>Yeni parola<input className="input" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          <button className="action primary" type="submit" disabled={saving}>{saving?'Doğrulanıyor…':'Parolamı sıfırla'}</button>
        </form>
      </>}
    </section>
  </main>;
}
