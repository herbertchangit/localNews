import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { FileText, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import { richTextToPlainText } from "./richTextUtils";

type Category = { id: string; name: string };
type DraftPhoto = { id: string; dataUrl: string; caption: string };
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Could not read photo"));
  reader.readAsDataURL(file);
});

export default function StoryComposer() {
  const location = useLocation(), token = session()?.token;
  const [canCreate, setCanCreate] = useState(false), [categories, setCategories] = useState<Category[]>([]), [host, setHost] = useState<HTMLElement | null>(null), [open, setOpen] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    if (!token) return;
    fetch("/api/story-options", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => { setCanCreate(data.canCreate); setCategories(data.categories); })
      .catch(() => setCanCreate(false));
  }, [token]);
  useEffect(() => {
    setHost(null);
    if (!canCreate || !["/newsroom", "/newsroom/stories"].includes(location.pathname)) return;
    const existing = [...document.querySelectorAll<HTMLButtonElement>(".dash .content .top button.new")].find((button) => button.textContent?.includes("New story"));
    if (existing) {
      const show = () => setOpen(true);
      existing.addEventListener("click", show);
      return () => existing.removeEventListener("click", show);
    }
    const top = document.querySelector<HTMLElement>(".audienceTop");
    if (!top) return;
    const mount = document.createElement("span");
    mount.className = "storyComposerMount";
    top.append(mount);
    setHost(mount);
    return () => mount.remove();
  }, [canCreate, location.pathname]);
  const created = (title: string) => {
    setOpen(false); setNotice(title);
    window.dispatchEvent(new CustomEvent("localnews:story-created"));
    setTimeout(() => setNotice(""), 4000);
  };
  if (!canCreate) return null;
  return <>{host && createPortal(<button className="new" onClick={() => setOpen(true)}><Plus />New story</button>, host)}{notice && createPortal(<div className="storyComposerNotice"><span>Draft saved:</span> {notice}<button onClick={() => setNotice("")}>×</button></div>, document.body)}{open && createPortal(<StoryModal categories={categories} token={token} onClose={() => setOpen(false)} onCreated={created} />, document.body)}</>;
}

function StoryModal({ categories, token, onClose, onCreated }: { categories: Category[]; token: string; onClose: () => void; onCreated: (title: string) => void }) {
  const [form, setForm] = useState({ title: "", excerpt: "", content: "", categoryId: categories[0]?.id || "" }), [photos, setPhotos] = useState<DraftPhoto[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const choosePhotos = async (files?: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files);
    if (photos.length + incoming.length > 12) return setError("A story can have up to 12 photos / 每篇新聞最多可有 12 張照片");
    for (const file of incoming) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Use PNG, JPEG or WebP photos / 請使用 PNG、JPEG 或 WebP 照片");
      if (file.size > 5 * 1024 * 1024) return setError("Each photo must be 5 MB or smaller / 每張照片不得超過 5 MB");
    }
    const additions = await Promise.all(incoming.map(async (file): Promise<DraftPhoto> => ({ id: crypto.randomUUID(), dataUrl: await fileToDataUrl(file), caption: "" })));
    setPhotos((items) => [...items, ...additions]);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (richTextToPlainText(form.excerpt).length < 20) return setError("Summary must contain at least 20 characters.");
    if (richTextToPlainText(form.excerpt).length > 600) return setError("Summary must contain no more than 600 characters.");
    if (richTextToPlainText(form.content).length < 40) return setError("Story content must contain at least 40 characters.");
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/articles", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const story = await response.json();
      if (!response.ok) throw new Error(story.error || "Could not save story");
      for (const photo of photos) {
        const photoResponse = await fetch(`/api/newsroom/articles/${story.id}/photos`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ dataUrl: photo.dataUrl, caption: photo.caption }) });
        const photoResult = await photoResponse.json();
        if (!photoResponse.ok) throw new Error(photoResult.error || "Draft saved, but a photo upload failed");
      }
      onCreated(story.title);
    } catch (caught: any) { setError(caught.message); }
    finally { setBusy(false); }
  };
  return <div className="modalBackdrop"><form className="userModal storyComposerModal" onSubmit={submit}>
    <div className="modalHead"><div><small>NEW STORY · 新增新聞</small><h2>Create story draft / 建立新聞草稿</h2></div><button type="button" onClick={onClose}><X /></button></div>
    <div className="storyComposerIntro"><FileText /><p>Start a draft for editorial review. It will not be published automatically.</p></div>
    {error && <div className="storyComposerError">{error}</div>}
    <label>Story photos and captions / 新聞照片及說明<div className="composerPhotoField"><ImagePlus /><span>Add up to 12 photos / 最多新增 12 張照片</span><input multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => choosePhotos(event.target.files)} /></div></label>
    {!!photos.length && <div className="composerGallery">{photos.map((photo, index) => <div key={photo.id}><img src={photo.dataUrl} alt={`Story preview ${index + 1}`} /><label>Caption / 圖片說明<input maxLength={240} placeholder="Describe this photo / 說明這張照片" value={photo.caption} onChange={(event) => setPhotos((items) => items.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item))} /></label><button type="button" onClick={() => setPhotos((items) => items.filter((item) => item.id !== photo.id))}><Trash2 />Remove / 移除</button></div>)}</div>}
    <label>Story title / 新聞標題<input required minLength={8} maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
    <label>News category / 新聞類別<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <div className="storyRichTextField"><span>Summary / 摘要</span><RichTextEditor compact label="Summary / 摘要" placeholder="Write a short story summary…" minLength={20} maxLength={600} value={form.excerpt} onChange={(excerpt) => setForm((current) => ({ ...current, excerpt }))} /></div>
    <div className="storyRichTextField"><span>Story content / 新聞內容</span><RichTextEditor label="Story content / 新聞內容" placeholder="Write the full story…" minLength={40} value={form.content} onChange={(content) => setForm((current) => ({ ...current, content }))} /></div>
    <div className="modalActions"><button type="button" onClick={onClose}>Cancel / 取消</button><button className="new" disabled={busy}><Save />{busy ? "Saving…" : "Save draft / 儲存草稿"}</button></div>
  </form></div>;
}
