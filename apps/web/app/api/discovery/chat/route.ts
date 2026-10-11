export async function POST() {
  return Response.json({
    ok: false,
    code: 'DISCOVERY_PROVIDER_NOT_CONFIGURED',
    message: 'Tasarlayalım AI için metin üretim sağlayıcısı yapılandırılmalıdır.',
  }, { status: 409 });
}
