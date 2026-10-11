export default function DesignStudioPage() {
  return <div className="content"><h1 className="page-title">AI Design Studio</h1><p className="page-subtitle">İsteğinizi doğal dille anlatın, referans ekleyin ve hedef çıktıyı üretim başlamadan tanımlayın.</p>
    <div className="chat-layout">
      <section className="card chat"><div className="chat-feed"><div className="empty"><div><strong>Yeni tasarım konuşması</strong><br/><span>İlk isteğinizi yazın veya bir referans görsel ekleyin.</span></div></div></div><div className="chat-composer"><textarea aria-label="Tasarım isteği" placeholder="Örn. Baskıya uygun, şeffaf arka planlı retro bir ürün etiketi tasarla…"/><button className="action primary">Gönder</button></div></section>
      <aside className="card"><h3>Üretim Ayarları</h3><div className="inspector-row"><span>Kalite</span><strong>Dengeli</strong></div><div className="inspector-row"><span>Çıktı amacı</span><strong>Dijital</strong></div><div className="inspector-row"><span>Model seçimi</span><strong>Otomatik</strong></div><div className="inspector-row"><span>Referans</span><strong>Yok</strong></div><p style={{marginTop:16}}>Baskı veya vektör hedefi seçildiğinde router yalnızca gerekli yetenekleri gerçekten destekleyen modelleri değerlendirir.</p></aside>
    </div></div>;
}
