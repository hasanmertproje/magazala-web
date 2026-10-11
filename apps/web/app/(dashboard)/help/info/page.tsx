export default function InfoPage() {
  const sections = [
    ['Platform hakkında','Modüler yapı sayesinde yalnızca erişiminiz olan çalışma alanlarını kullanırsınız. Creative ve commerce modülleri birbirinden bağımsız geliştirilebilir.'],
    ['Aktif modüller','AI Design Studio, Product Intelligence, Projeler ve Dosyalar ilk aktif çalışma alanlarıdır.'],
    ['Beta ve Preview','Beta, çalışan ancak kapsamı genişletilen alanları; Preview ise operasyon kuralları kesinleşmeden önce hazırlanan kontrollü çalışma alanlarını ifade eder.'],
    ['Tasarım çıktıları','Vektör, raster, DPI ve renk uzayı birbirinden farklı teknik özelliklerdir. Sistem bir dosyayı yalnızca uzantısını değiştirerek vektör veya baskıya hazır olarak işaretlemez.'],
    ['Özellik talepleri','Özellikler Hakkında Konuş bölümünde Tasarlayalım AI ile ihtiyacınızı görüşebilir ve onaylamadan önce yapılandırılmış özeti kontrol edebilirsiniz.'],
    ['Veri ve güvenlik','Workspace verileri birbirinden ayrılır. Servis sağlayıcı API anahtarları kullanıcı arayüzüne gönderilmez ve erişim kontrolleri sunucu tarafında uygulanır.'],
  ];
  return <div className="content"><h1 className="page-title">Bilgilendirme</h1><p className="page-subtitle">Platformdaki modüller, durum etiketleri ve teknik çıktılar hakkında kısa kullanım rehberi.</p><div className="grid">{sections.map(([title,body])=><section className="card span-6" key={title}><h3>{title}</h3><p>{body}</p></section>)}</div></div>;
}
