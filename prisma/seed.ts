import { PrismaClient, Role, ArticleStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
const p = new PrismaClient();

async function main() {
  const initialized = await p.user.findUnique({ where: { email: 'admin@local.news' }, select: { id: true } });
  if (initialized) {
    console.log('Database already initialized; preserving user-managed records.');
    return;
  }
  const password = await bcrypt.hash('Demo123!', 12);
  const departments = await Promise.all(['Central News Desk','Politics Desk','Business Desk','Sports Desk','Digital & Audience','Charity Mission','Medical Mission','Education Mission','Humanistic Mission'].map(name => p.department.upsert({ where: { name }, update: {}, create: { name } })));
  const users = await Promise.all([
    ['admin@local.news','Harper Cole',Role.ADMIN,0],
    ['editor@local.news','Nadia Brooks',Role.VOLUNTEER,0],
    ['reporter@local.news','Aisha Rahman',Role.VOLUNTEER,1],
    ['reader@local.news','Sam Reader',Role.DADE,4]
  ].map(([email,name,role,department]) => p.user.upsert({ where: { email: email as string }, update: { role: role as Role, departmentId: departments[department as number].id }, create: { email: email as string, name: name as string, role: role as Role, password, departmentId: departments[department as number].id, permissions: role === Role.ADMIN ? ['users.manage','articles.publish','analytics.view','comments.moderate'] : [] } })));
  const cats = await Promise.all(['Local','Politics','Business','Sports','Culture'].map(name => p.category.upsert({ where: { slug: name.toLowerCase() }, update: {}, create: { name, slug: name.toLowerCase() } })));
  const orgChart=[
    ['中三','蒲種都','金鑾鎮'],['中三','蒲種都','金鑾花園'],['中三','蒲種都','再也A'],
    ['中三','蒲種市','再也B'],['中三','蒲種市','宏源A'],['中三','蒲種市','宏源B'],
    ['中三','蒲種城','公主A'],['中三','蒲種城','公主B'],['中三','蒲種城','山嶺鎮1'],
    ['中三','蒲種鎮','山嶺鎮2'],['中三','蒲種鎮','泊力碼'],['中三','蒲種鎮','普特啦']
  ];
  for(let i=0;i<orgChart.length;i++){const[harmony,mutualLove,cooperation]=orgChart[i];await p.orgChartEntry.upsert({where:{harmony_mutualLove_cooperation:{harmony,mutualLove,cooperation}},update:{sortOrder:i+1},create:{harmony,mutualLove,cooperation,sortOrder:i+1}})}
  const harmonyNames=[...new Set(orgChart.map(x=>x[0]))];
  for(let hi=0;hi<harmonyNames.length;hi++){const harmonyName=harmonyNames[hi];const harmony=await p.harmonyGroup.upsert({where:{name:harmonyName},update:{sortOrder:hi+1},create:{name:harmonyName,sortOrder:hi+1}});const mutualNames=[...new Set(orgChart.filter(x=>x[0]===harmonyName).map(x=>x[1]))];for(let mi=0;mi<mutualNames.length;mi++){const mutualName=mutualNames[mi];const mutual=await p.mutualLoveGroup.upsert({where:{harmonyId_name:{harmonyId:harmony.id,name:mutualName}},update:{sortOrder:mi+1},create:{harmonyId:harmony.id,name:mutualName,sortOrder:mi+1}});const units=orgChart.filter(x=>x[0]===harmonyName&&x[1]===mutualName).map(x=>x[2]);for(let ci=0;ci<units.length;ci++){await p.cooperationUnit.upsert({where:{mutualLoveId_name:{mutualLoveId:mutual.id,name:units[ci]}},update:{sortOrder:ci+1},create:{mutualLoveId:mutual.id,name:units[ci],sortOrder:ci+1}})}}}
  await p.user.update({where:{id:users[2].id},data:{assignedCategories:{set:[{id:cats[0].id},{id:cats[1].id}]}}});
  const samples:[string,string,boolean,number][]=[
    ['City council approves riverside renewal plan','The long-awaited project will add green space, safer walkways and a community market.',true,12480],
    ['Small businesses lead downtown weekend revival','Independent shops and cafés report their strongest quarter in three years.',false,8340],
    ['Tigers secure dramatic cup semi-final victory','A stoppage-time winner sent the home crowd into celebration.',false,6210]
  ];
  for(let i=0;i<samples.length;i++){const[title,excerpt,breaking,views]=samples[i];const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');await p.article.upsert({where:{slug},update:{},create:{title,slug,excerpt,content:excerpt+' Local News will continue to follow this developing story and bring readers verified updates.',status:ArticleStatus.PUBLISHED,isBreaking:breaking,isTrending:i<2,views,authorId:users[2].id,categoryId:cats[i===2?3:i].id,publishedAt:new Date()}})}
}
main().finally(()=>p.$disconnect());
