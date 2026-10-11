export async function POST() {
  return Response.json({
    ok: false,
    code: 'NO_IMAGE_PROVIDER_CONFIGURED',
    message: 'Görsel üretimi için uygun ve yetkilendirilmiş bir provider yapılandırılmalıdır.',
  }, { status: 409 });
}
