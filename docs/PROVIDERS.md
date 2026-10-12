# Providers

Provider Center bir API anahtarı listesi değildir. Her sağlayıcı için capability, health, quota, fiyat sınıfı, resmi kaynak, runtime adaptörü ve son doğrulama tarihi tutulur.

## Sınıflandırma
- FREE_ENDPOINT
- FREE_CREDIT
- FREE_TIER
- TRIAL
- PAID
- SELF_HOSTED
- UNKNOWN_NEEDS_REVERIFY

## Güvenlik
Credential değerleri veritabanında authenticated encryption ile saklanır. Kullanıcıya yalnızca maskelenmiş metadata gösterilir. Raw key frontend response'larına dahil edilmez.

## Runtime destek matrisi
Bir provider kaydının veya model capability etiketinin bulunması tek başına üretim desteği anlamına gelmez. Uygulama yalnız gerçek runtime adaptörü bulunan sağlayıcıları hazır kabul eder.

Mevcut adaptörler:
- NVIDIA NIM: metin üretimi / Tasarlayalım AI / Product Intelligence
- Google Gemini Developer API: metin üretimi / Tasarlayalım AI / Product Intelligence
- Cloudflare Workers AI: metin üretimi + text-to-image
- Hugging Face Inference Providers: text-to-image + image-to-image

Henüz runtime adaptörü bağlı olmayan provider'lar Provider Center'da rehber/kayıt olarak tutulabilir; model capability bilgisi bu durumu değiştirmez. Recraft şu anda bu gruptadır.

Runtime destek bilgisi `apps/web/lib/provider-runtime.ts` içinde merkezi tutulur; Model Registry, Provider Center ve Sistem Sağlığı aynı matrisi kullanır.

## Model keşfi
Admin, desteklenen sağlayıcılarda gerçek model kimliklerini sağlayıcı API'sinden sunucu tarafında keşfedebilir. API anahtarı tarayıcıya gönderilmez.

Desteklenen ilk keşif akışları:
- NVIDIA NIM: model ID listesi alınır; katalog güvenilir görev tipi vermediği için capability otomatik atanmaz.
- Google Gemini: `supportedGenerationMethods` metadata'sı görüntülenir; `generateContent` varsa `text_generation` yalnız öneri olarak işaretlenir.
- Cloudflare Workers AI: provider'ın task metadata'sı başlangıç capability önerisine çevrilebilir; bunun için sunucuda `CLOUDFLARE_ACCOUNT_ID` gerekir.

Model keşfi hiçbir zaman model lisansı, ticari kullanım hakkı, gerçek kalite veya tüm yeteneklerin doğrulandığı anlamına gelmez. Admin, modeli etkinleştirmeden önce capability ve ticari kullanım koşullarını doğrulamalıdır.

## Cloudflare Workers AI kurulumu
1. Cloudflare Dashboard üzerinden Workers AI REST API için uygun API token oluşturun.
2. Account ID değerini sunucu ortamına `CLOUDFLARE_ACCOUNT_ID` olarak ekleyin. Account ID secret değildir; API token yine Provider Center içinde şifreli tutulur.
3. API tokenı Provider Center üzerinden ekleyip bağlantıyı test edin.
4. Model Registry model keşfi ile güncel kataloğu alın.
5. Seçilen modelin task/capability, lisans ve ticari kullanım koşullarını resmi model dokümanından doğrulayın.
6. Text-to-image modelini ticari kullanımı doğrulanmadan production görsel router'ına dahil etmeyin.

REST runtime sözleşmesi: `POST /accounts/{account_id}/ai/run/{model}`. Metin adapterı scoped `messages` kullanır. Görsel adapterı text-to-image modellerinin image/base64 çıktısını gerçek asset pipeline'a geçirir. Generic Cloudflare adapterı image-to-image/reference edit desteği varmış gibi davranmaz.

## İlk adaylar
NVIDIA NIM, Hugging Face Inference Providers, Cloudflare Workers AI, Google Gemini Developer API ve Recraft provider olarak değerlendirilebilir. Seed kayıtları kesin fiyat/ücretsiz kota iddiası taşımaz; resmi kaynakla son doğrulama yapılmadan ACTIVE ücretsiz provider olarak işaretlenmez.

## 2026-10 doğrulaması
- NVIDIA NIM: Developer Program erişimi prototipleme/geliştirme/test içindir; production için uygun enterprise lisansı gerekir. Kaynak: https://docs.api.nvidia.com/nim/docs/product
- Hugging Face Inference Providers: ücretsiz hesapta küçük aylık inference kredisi vardır ve miktar değişebilir. Kaynak: https://huggingface.co/docs/inference-providers/en/pricing
- Cloudflare Workers AI: ücretsiz allocation ve ücretli kullanım koşulları model/platform pricing'e göre değişebilir; REST sözleşmesi ve model kataloğu resmi dokümandan doğrulanmalıdır. Kaynak: https://developers.cloudflare.com/workers-ai/
- Google Gemini API: bazı text modellerinde free tier bulunabilir; image generation için model bazında güncel pricing doğrulanmalıdır. Kaynak: https://ai.google.dev/gemini-api/docs/pricing
- Recraft API: raster/vector generation ve editing API Units ile ücretlendirilir; web free planı API free tier anlamına gelmez. Kaynak: https://www.recraft.ai/pricing?tab=api
