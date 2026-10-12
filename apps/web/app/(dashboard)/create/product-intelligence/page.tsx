import { ProductIntelligenceStudio } from '../../../../components/product-intelligence-studio';

export default function ProductIntelligencePage() {
  return <div className="content">
    <span className="badge active">ACTIVE</span>
    <h1 className="page-title" style={{marginTop:12}}>Product Intelligence</h1>
    <p className="page-subtitle">Fikir üretimi ile kaynaklı araştırmayı birbirinden ayırın. Idea Mode yaratıcı öneri üretir; Research Mode gerçek kaynakları tarih ve kanıt türüyle kaydeder.</p>
    <ProductIntelligenceStudio />
  </div>;
}
