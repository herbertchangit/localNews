import{useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{useLocation}from'react-router-dom';
import{FileText,Plus,Save,X}from'lucide-react';

type Category={id:string;name:string};
const session=()=>JSON.parse(localStorage.getItem('ln_session')||'null');

export default function StoryComposer(){
  const location=useLocation(),token=session()?.token;
  const[canCreate,setCanCreate]=useState(false),[categories,setCategories]=useState<Category[]>([]),[host,setHost]=useState<HTMLElement|null>(null),[open,setOpen]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{if(!token)return;fetch('/api/story-options',{headers:{Authorization:`Bearer ${token}`}}).then(async r=>{const x=await r.json();if(!r.ok)throw new Error(x.error);return x}).then(x=>{setCanCreate(x.canCreate);setCategories(x.categories)}).catch(()=>setCanCreate(false))},[token]);
  useEffect(()=>{setHost(null);if(!canCreate||location.pathname!=='/newsroom')return;const existing=[...document.querySelectorAll<HTMLButtonElement>('.dash .content .top button.new')].find(x=>x.textContent?.includes('New story'));if(existing){const show=()=>setOpen(true);existing.addEventListener('click',show);return()=>existing.removeEventListener('click',show)}const top=document.querySelector<HTMLElement>('.audienceTop');if(!top)return;const mount=document.createElement('span');mount.className='storyComposerMount';top.append(mount);setHost(mount);return()=>mount.remove()},[canCreate,location.pathname]);
  const created=(title:string)=>{setOpen(false);setNotice(title);setTimeout(()=>setNotice(''),4000)};
  if(!canCreate)return null;
  return <>{host&&createPortal(<button className="new" onClick={()=>setOpen(true)}><Plus/>New story</button>,host)}{notice&&createPortal(<div className="storyComposerNotice"><span>Draft saved:</span> {notice}<button onClick={()=>setNotice('')}>×</button></div>,document.body)}{open&&createPortal(<StoryModal categories={categories} token={token} onClose={()=>setOpen(false)} onCreated={created}/>,document.body)}</>;
}

function StoryModal({categories,token,onClose,onCreated}:{categories:Category[];token:string;onClose:()=>void;onCreated:(title:string)=>void}){
  const[form,setForm]=useState({title:'',excerpt:'',content:'',categoryId:categories[0]?.id||''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/articles',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(form)}),x=await r.json();if(!r.ok)throw new Error(x.error||'Could not save story');onCreated(x.title)}catch(e:any){setError(e.message)}finally{setBusy(false)}};
  return <div className="modalBackdrop"><form className="userModal storyComposerModal" onSubmit={submit}><div className="modalHead"><div><small>NEW STORY</small><h2>Create story draft</h2></div><button type="button" onClick={onClose}><X/></button></div><div className="storyComposerIntro"><FileText/><p>Start a draft for editorial review. It will not be published automatically.</p></div>{error&&<div className="storyComposerError">{error}</div>}<label>Story title<input required minLength={8} maxLength={180} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>News category<select required value={form.categoryId} onChange={e=>setForm({...form,categoryId:e.target.value})}><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Summary<textarea required minLength={20} rows={3} value={form.excerpt} onChange={e=>setForm({...form,excerpt:e.target.value})}/></label><label>Story content<textarea required minLength={40} rows={8} value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/></label><div className="modalActions"><button type="button" onClick={onClose}>Cancel</button><button className="new" disabled={busy}><Save/>{busy?'Saving…':'Save draft'}</button></div></form></div>;
}
