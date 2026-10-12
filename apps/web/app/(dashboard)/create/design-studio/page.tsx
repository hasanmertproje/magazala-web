import { DesignStudio } from '../../../../components/design-studio';

export default async function DesignStudioPage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  const params = await searchParams;
  const initialPrompt = typeof params.prompt === 'string' ? params.prompt.trim().slice(0, 3200) : '';
  return <div className="content">
    <span className="badge active">ACTIVE</span>
    <h1 className="page-title" style={{marginTop:12}}>AI Design Studio</h1>
    <p className="page-subtitle">İsteğinizi doğal dille anlatın. Model, etkin yetenekler ve admin tarafından doğrulanmış kullanım koşullarına göre otomatik seçilir; çıktı özel asset alanına kaydedilir.</p>
    <DesignStudio initialPrompt={initialPrompt}/>
  </div>;
}
