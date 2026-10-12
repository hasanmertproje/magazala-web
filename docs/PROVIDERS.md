# Providers

Provider Center bir API anahtarı listesi değildir. Her sağlayıcı için capability, health, quota, fiyat sınıfı, resmi kaynak ve son doğrulama tarihi tutulur.

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

## İlk adaylar
NVIDIA NIM, Hugging Face Inference Providers, Cloudflare Workers AI, Google Gemini Developer API ve Recraft adapter olarak değerlendirilebilir. Seed kayıtları kesin fiyat/ücretsiz kota iddiası taşımaz; resmi kaynakla son doğrulama yapılmadan ACTIVE ücretsiz provider olarak işaretlenmez.

## 2026-10-11 doğrulaması
- NVIDIA NIM: Developer Program erişimi prototipleme/geliştirme/test içindir; production için uygun enterprise lisansı gerekir. Kaynak: https://docs.api.nvidia.com/nim/docs/product
- Hugging Face Inference Providers: ücretsiz hesapta küçük aylık inference kredisi vardır ve miktar değişebilir. Kaynak: https://huggingface.co/docs/inference-providers/en/pricing
- Cloudflare Workers AI: günlük ücretsiz allocation vardır; bazı modeller yalnızca paid plan ile kullanılabilir. Kaynak: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Google Gemini API: bazı text modellerinde free tier bulunabilir; güncel native image generation modellerinde API free tier mevcut görünmemektedir. Kaynak: https://ai.google.dev/gemini-api/docs/pricing
- Recraft API: raster/vector generation ve editing API Units ile ücretlendirilir; web free planı API free tier anlamına gelmez. Kaynak: https://www.recraft.ai/pricing?tab=api
