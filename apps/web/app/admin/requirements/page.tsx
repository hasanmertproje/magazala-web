import { Prisma, RequirementCategory, RequirementStatus } from '@prisma/client';
import Link from 'next/link';
import { db } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const closedStatuses = new Set<RequirementStatus>(['RELEASED','REJECTED','MERGED']);
const statusLabels: Record<RequirementStatus,string> = {
  NEW:'Yeni', NEEDS_REVIEW:'İnceleme gerekli', NEEDS_CLARIFICATION:'Ek bilgi gerekli', ACCEPTED:'Kabul edildi', PLANNED:'Planlandı', IN_PROGRESS:'Geliştiriliyor', BETA:'Beta', RELEASED:'Yayınlandı', REJECTED:'Reddedildi', MERGED:'Birleştirildi',
};
const categoryLabels: Record<RequirementCategory,string> = {
  BUG:'Hata', FEATURE_REQUEST:'Yeni özellik', CHANGE_REQUEST:'Değişiklik', WORKFLOW_REQUIREMENT:'İş akışı', INTEGRATION:'Entegrasyon', UI_UX:'UI/UX', DATA_REQUIREMENT:'Veri ihtiyacı', AUTOMATION:'Otomasyon', QUESTION:'Soru',
};

export default async function RequirementsAdminPage({ searchParams }: { searchParams: Promise<{ status?:string; category?:string; workspaceId?:string; q?:string }> }) {
  const params = await searchParams;
  const status = Object.values(RequirementStatus).includes(params.status as RequirementStatus) ? params.status as RequirementStatus : undefined;
  const category = Object.values(RequirementCategory).includes(params.category as RequirementCategory) ? params.category as RequirementCategory : undefined;
  const workspaceId = params.workspaceId?.trim() || undefined;
  const q = params.q?.trim().slice(0,120) || undefined;

  const where: Prisma.RequirementWhereInput = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(workspaceId ? { workspaceId } : {}),
    ...(q ? { OR: [
      { title: { contains:q, mode:'insensitive' } },
      { module: { contains:q, mode:'insensitive' } },
      { description: { contains:q, mode:'insensitive' } },
      { workspace: { name: { contains:q, mode:'insensitive' } } },
    ] } : {}),
  };

  const [requirements, workspaces, statusCounts, total] = await Promise.all([
    db.requirement.findMany({
      where,
      include: { workspace:{select:{id:true,name:true,slug:true}}, conversation:{select:{id:true,userId:true,confirmationState:true,status:true}} },
      orderBy:[{updatedAt:'desc'}],
      take:200,
    }),
    db.workspace.findMany({ select:{id:true,name:true}, orderBy:{name:'asc'} }),
    db.requirement.groupBy({ by:['status'], _count:{_all:true} }),
    db.requirement.count(),
  ]);
  const userIds = [...new Set(requirements.map((item)=>item.conversation.userId))];
  const users = userIds.length ? await db.user.findMany({ where:{id:{in:userIds}}, select:{id:true,email:true,displayName:true} }) : [];
  const userById = new Map(users.map((user)=>[user.id,user]));
  const countByStatus = new Map(statusCounts.map((row)=>[row.status,row._count._all]));
  const openCount = [...countByStatus.entries()].filter(([key])=>!closedStatuses.has(key)).reduce((sum,[,value])=>sum+value,0);

  return <div className="content">
    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><h1 className="page-title">Tasarlayalım AI Talepleri</h1><p className="page-subtitle">Kullanıcı tarafından onaylanan gereksinimleri ham konuşmadan ve AI analizinden ayrı olarak inceleyin, önceliklendirin ve geliştirme girdisi olarak dışa aktarın.</p></div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}><span className="badge active">{openCount} AÇIK</span><span className="badge">{countByStatus.get('NEW') ?? 0} YENİ</span><span className="badge">{total} TOPLAM</span></div>
    </div>

    <section className="card" style={{marginTop:18}}>
      <form method="get" style={{display:'grid',gridTemplateColumns:'minmax(180px,1fr) repeat(3,minmax(150px,220px)) auto',gap:8,alignItems:'center'}}>
        <input className="input" name="q" defaultValue={q ?? ''} placeholder="Başlık, modül, müşteri veya açıklama ara"/>
        <select className="input" name="status" defaultValue={status ?? ''}><option value="">Tüm durumlar</option>{Object.values(RequirementStatus).map((value)=><option key={value} value={value}>{statusLabels[value]}</option>)}</select>
        <select className="input" name="category" defaultValue={category ?? ''}><option value="">Tüm türler</option>{Object.values(RequirementCategory).map((value)=><option key={value} value={value}>{categoryLabels[value]}</option>)}</select>
        <select className="input" name="workspaceId" defaultValue={workspaceId ?? ''}><option value="">Tüm müşteriler</option>{workspaces.map((workspace)=><option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select>
        <button className="action" type="submit">Filtrele</button>
      </form>
    </section>

    <div style={{display:'grid',gap:12,marginTop:18}}>
      {requirements.length===0 ? <section className="card"><div className="empty"><div><strong>Eşleşen talep yok</strong><br/><span>Filtreleri değiştirin veya kullanıcı tarafından onaylanmış yeni bir gereksinim bekleyin.</span></div></div></section> : requirements.map((requirement)=>{
        const user=userById.get(requirement.conversation.userId);
        const priority=requirement.adminPriority ?? requirement.aiPrioritySuggestion ?? requirement.userPriority;
        return <Link href={`/admin/requirements/${requirement.id}`} className="card" key={requirement.id} style={{display:'block',textDecoration:'none',color:'inherit'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{minWidth:0,flex:'1 1 460px'}}><div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}><span className={`badge ${requirement.status==='NEW'?'active':''}`}>{statusLabels[requirement.status]}</span><span className="badge">{categoryLabels[requirement.category]}</span>{priority?<span className="badge">ÖNCELİK {priority}</span>:null}</div><h2 style={{fontSize:18,margin:'9px 0 5px'}}>{requirement.title}</h2><div style={{color:'var(--muted)',fontSize:12}}>{requirement.workspace.name} · {requirement.module} · {user?.displayName ?? user?.email ?? 'Kullanıcı'}</div><p style={{margin:'9px 0 0',fontSize:13,lineHeight:1.55,color:'var(--muted)',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{requirement.description}</p></div>
            <div style={{textAlign:'right',fontSize:11,color:'var(--muted)'}}>REQ #{requirement.id.slice(-8)}<br/>{requirement.updatedAt.toLocaleString('tr-TR')}</div>
          </div>
        </Link>;
      })}
    </div>
  </div>;
}
