import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getAuthContext } from '../../lib/auth';
import { db } from '../../lib/db';
import { hashInvitationToken, isStructurallyValidInvitationToken } from '../../lib/invitations';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { referrer: 'no-referrer' };

const errorMessages: Record<string, string> = {
  INVITATION_INVALID: 'Davet bağlantısı geçerli değil.',
  INVITATION_REVOKED: 'Bu davet iptal edilmiş.',
  INVITATION_EXPIRED: 'Bu davetin süresi dolmuş.',
  INVITATION_ALREADY_ACCEPTED: 'Bu davet daha önce kullanılmış.',
  INVITATION_NO_LONGER_VALID: 'Davet artık geçerli değil.',
  EXISTING_ACCOUNT_LOGIN_REQUIRED: 'Bu e-posta için mevcut hesabınızla giriş yapmanız gerekiyor.',
  ACCOUNT_DETAILS_REQUIRED: 'Ad ve parola bilgilerini eksiksiz girin.',
  ACCOUNT_CREATED_CONCURRENTLY: 'Bu e-posta için hesap oluşturuldu. Mevcut hesabınızla giriş yapın.',
};

function inviteState(invitation: { revokedAt: Date | null; acceptedAt: Date | null; expiresAt: Date } | null) {
  if (!invitation) return 'INVITATION_INVALID';
  if (invitation.revokedAt) return 'INVITATION_REVOKED';
  if (invitation.acceptedAt) return 'INVITATION_ALREADY_ACCEPTED';
  if (invitation.expiresAt.getTime() <= Date.now()) return 'INVITATION_EXPIRED';
  return null;
}

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string; notice?: string }> }) {
  const params = await searchParams;
  const token = params.token ?? '';
  if (!isStructurallyValidInvitationToken(token)) {
    return <InviteShell><InviteError message={errorMessages.INVITATION_INVALID}/></InviteShell>;
  }

  const invitation = await db.workspaceInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { workspace: { select: { name: true } } },
  });
  const state = inviteState(invitation);
  if (state || !invitation) return <InviteShell><InviteError message={errorMessages[state ?? 'INVITATION_INVALID']}/></InviteShell>;

  const [existingUser, auth] = await Promise.all([
    db.user.findUnique({ where: { email: invitation.email }, select: { id: true } }),
    getAuthContext(),
  ]);
  const returnPath = `/invite?token=${encodeURIComponent(token)}`;
  const requestError = params.error ? (errorMessages[params.error] ?? 'Davet işlemi tamamlanamadı.') : null;

  return <InviteShell>
    <span className="badge active">DAVET GEÇERLİ</span>
    <h1 className="page-title" style={{marginTop:14}}>{invitation.workspace.name}</h1>
    <p className="page-subtitle">{invitation.email} adresi <strong>{invitation.role === 'ADMIN' ? 'yönetici' : 'kullanıcı'}</strong> rolüyle çalışma alanına davet edildi. Davet {invitation.expiresAt.toLocaleString('tr-TR')} tarihine kadar kullanılabilir.</p>
    {requestError ? <p style={{marginTop:14,color:'var(--danger)'}}>{requestError}</p> : null}

    {existingUser ? (
      auth?.user.id === existingUser.id ? <form action="/api/invitations/accept" method="post" style={{display:'grid',gap:12,marginTop:22}}><input type="hidden" name="token" value={token}/><p className="page-subtitle">Doğru hesapla giriş yaptınız. Daveti kabul ettiğinizde bu çalışma alanına erişim eklenecek.</p><button className="action primary" type="submit">Daveti kabul et</button></form>
      : <div style={{marginTop:22}}><p className="page-subtitle">Bu e-posta zaten kayıtlı. Yeni hesap oluşturulmayacak; mevcut hesabınızla giriş yaptıktan sonra daveti kabul edebilirsiniz.</p><Link className="action primary" href={`/login?next=${encodeURIComponent(returnPath)}`}>Mevcut hesapla giriş yap</Link></div>
    ) : (
      <form action="/api/invitations/accept" method="post" style={{display:'grid',gap:12,marginTop:22}}>
        <input type="hidden" name="token" value={token}/>
        <label>Adınız<input className="input" name="displayName" autoComplete="name" minLength={2} maxLength={80} required/></label>
        <label>Parola<input className="input" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <p style={{margin:0,color:'var(--muted)',fontSize:12}}>Parola en az 12 karakter olmalıdır. Parolanızı yönetici belirlemez.</p>
        <button className="action primary" type="submit">Hesabı oluştur ve daveti kabul et</button>
      </form>
    )}
  </InviteShell>;
}

function InviteShell({ children }: { children: ReactNode }) {
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}><section className="card" style={{width:'min(560px,100%)'}}><div className="brand" style={{marginBottom:22}}>EntegrePilot</div>{children}</section></main>;
}

function InviteError({ message }: { message: string }) {
  return <><h1 className="page-title">Davet kullanılamıyor</h1><p className="page-subtitle">{message}</p><Link className="action" href="/login" style={{marginTop:18}}>Giriş sayfasına dön</Link></>;
}
