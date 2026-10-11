export async function POST() {
  return Response.json({
    ok: false,
    code: 'PROVIDER_NOT_CONFIGURED',
    message: 'Sağlayıcı kimlik bilgileri yapılandırılmadan bağlantı testi çalıştırılamaz.',
  }, { status: 409 });
}
