import { DesignStudio } from '../../../../components/design-studio';

export default function DesignStudioPage() {
  return <div className="content">
    <span className="badge active">ACTIVE</span>
    <h1 className="page-title" style={{marginTop:12}}>AI Design Studio</h1>
    <p className="page-subtitle">İsteğinizi doğal dille anlatın. Model, etkin yetenekler ve admin tarafından doğrulanmış kullanım koşullarına göre otomatik seçilir; çıktı özel asset alanına kaydedilir.</p>
    <DesignStudio />
  </div>;
}
