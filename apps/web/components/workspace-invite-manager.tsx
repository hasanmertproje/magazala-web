'use client';

import { useState, type FormEvent } from 'react';

type WorkspaceOption = { id: string; name: string };
type CreatedInvitation = { id: string; email: string; role: 'ADMIN' | 'USER'; expiresAt: string; workspace: { name: string } };

type CreateResponse = {
  ok: boolean;
  code?: string;
  invitation?: CreatedInvitation;
  invitePath?: string;
};

const errorText: Record<string, string> = {
  WORKSPACE_NOT_FOUND: 'Çalışma alanı bulunamadı.',
  USER_ALREADY_MEMBER: 'Bu kullanıcı zaten seçilen çalışma alanının üyesi.',
  INVITATION_CREATE_FAILED: 'Davet oluşturulamadı.',
};

export function WorkspaceInviteManager({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setCreatedUrl(null);
    setCreated(null);
    setCopied(false);
    try {
      const form = new FormData(event.currentTarget);
      const workspaceId = String(form.get('workspaceId') ?? '');
      const response = await fetch(`/api/admin/workspaces/${encodeURIComponent(workspaceId)}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          role: String(form.get('role') ?? 'USER'),
          expiresInHours: Number(form.get('expiresInHours') ?? 72),
        }),
      });
      const payload = await response.json() as CreateResponse;
      if (!response.ok || !payload.ok || !payload.invitation || !payload.invitePath) throw new Error(payload.code ?? 'INVITATION_CREATE_FAILED');
      setCreated(payload.invitation);
      setCreatedUrl(`${window.location.origin}${payload.invitePath}`);
      event.currentTarget.reset();
    } catch (errorValue) {
      const code = errorValue instanceof Error ? errorValue.message : 'INVITATION_CREATE_FAILED';
      setError(errorText[code] ?? `Davet oluşturulamadı (${code}).`);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (workspaces.length === 0) return <section className="card" style={{marginTop:18}}><h3>Yeni kullanıcı daveti</h3><p className="page-subtitle">Davet oluşturmak için önce bir çalışma alanı bulunmalıdır.</p></section>;

  return <section className="card" style={{marginTop:18}}>
    <h3>Yeni kullanıcı daveti</h3>
    <p className="page-subtitle">Yönetici kullanıcı adına parola belirlemez. Sistem tek kullanımlık, süreli bir bağlantı üretir; raw token yalnız bu oluşturma yanıtında görünür.</p>
    <form onSubmit={submit} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginTop:14}}>
      <select className="input" name="workspaceId" required defaultValue={workspaces[0]?.id}>{workspaces.map((workspace)=><option value={workspace.id} key={workspace.id}>{workspace.name}</option>)}</select>
      <input className="input" name="email" type="email" autoComplete="off" placeholder="E-posta" required/>
      <select className="input" name="role" defaultValue="USER"><option value="USER">Kullanıcı</option><option value="ADMIN">Yönetici</option></select>
      <select className="input" name="expiresInHours" defaultValue="72"><option value="24">24 saat</option><option value="72">3 gün</option><option value="168">7 gün</option></select>
      <button className="action primary" type="submit" disabled={busy}>{busy?'Oluşturuluyor…':'Davet oluştur'}</button>
    </form>
    {error ? <p style={{color:'var(--danger)',marginTop:12}}>{error}</p> : null}
    {createdUrl && created ? <div style={{marginTop:16,padding:16,border:'1px solid var(--line)',borderRadius:14}}>
      <strong>Davet bağlantısı hazır</strong>
      <p className="page-subtitle" style={{marginTop:6}}>{created.workspace.name} · {created.email} · {created.role} · son kullanım {new Date(created.expiresAt).toLocaleString('tr-TR')}</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8}}><input className="input" readOnly value={createdUrl}/><button className="action" type="button" onClick={copy}>{copied?'Kopyalandı':'Kopyala'}</button></div>
      <p style={{margin:'8px 0 0',color:'var(--muted)',fontSize:12}}>Bu bağlantı güvenlik nedeniyle daha sonra admin panelinden tekrar görüntülenemez. Kaybedilirse eski daveti iptal edip yeni davet oluşturun.</p>
    </div> : null}
  </section>;
}
