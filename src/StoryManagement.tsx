import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Camera,
  FileText,
  EyeOff,
  ImagePlus,
  LayoutDashboard,
  Pencil,
  Plus,
  Save,
  Settings,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import { richTextToPlainText } from "./richTextUtils";
import { openStoryComposer } from "./StoryComposer";

type Category = { id: string; name: string };
type StoryPhoto = { id: string; url: string; caption: string | null; sortOrder: number };
type EditablePhoto = StoryPhoto & { dataUrl?: string; removed?: boolean; originalCaption?: string };
type Story = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  status: string;
  isHeadline: boolean;
  imageUrl: string | null;
  photos: StoryPhoto[];
  updatedAt: string;
  author: { name: string };
  category: Category;
  categoryId: string;
};
type Session = { token: string; user: { name: string; role: string } };

const session = (): Session | null => {
  try { return JSON.parse(localStorage.getItem("ln_session") || "null"); }
  catch { return null; }
};

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Could not read photo"));
  reader.readAsDataURL(file);
});

export default function StoryManagement() {
  const nav = useNavigate();
  const current = session();
  const isAdmin = current?.user.role === "ADMIN";
  const isEditor = current?.user.role === "EDITOR";
  const [stories, setStories] = useState<Story[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);
  const [photos, setPhotos] = useState<EditablePhoto[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [headlineBusy, setHeadlineBusy] = useState("");
  const [unpublishBusy, setUnpublishBusy] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const headers = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${current?.token || ""}` }), [current?.token]);

  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };

  const load = async () => {
    setBusy(true);
    try {
      const [items, options] = await Promise.all([api("/api/newsroom/articles"), api("/api/story-options")]);
      setStories(items);
      setCategories(options.categories);
      setCanCreate(Boolean(options.canCreate));
    } catch (error: any) { setNotice(error.message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    load();
    const reload = () => load();
    window.addEventListener("localnews:story-created", reload);
    return () => window.removeEventListener("localnews:story-created", reload);
  }, []);

  const open = (story: Story) => {
    setEditing({ ...story });
    setPhotos((story.photos || []).map((photo) => ({ ...photo, originalCaption: photo.caption || "" })));
  };

  const selectPhotos = async (files?: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const activeCount = photos.filter((photo) => !photo.removed).length;
    if (activeCount + incoming.length > 12) return setNotice("A story can have up to 12 photos / 每篇新聞最多可有 12 張照片");
    for (const file of incoming) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setNotice("Use PNG, JPEG or WebP photos / 請使用 PNG、JPEG 或 WebP 照片");
      if (file.size > 5 * 1024 * 1024) return setNotice("Each photo must be 5 MB or smaller / 每張照片不得超過 5 MB");
    }
    const additions = await Promise.all(incoming.map(async (file, index): Promise<EditablePhoto> => ({
      id: `new-${crypto.randomUUID()}`,
      url: "",
      dataUrl: await fileToDataUrl(file),
      caption: "",
      sortOrder: activeCount + index,
      originalCaption: "",
    })));
    setPhotos((items) => [...items, ...additions]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (richTextToPlainText(editing.excerpt).length < 20) return setNotice("Summary must contain at least 20 characters.");
    if (richTextToPlainText(editing.excerpt).length > 600) return setNotice("Summary must contain no more than 600 characters.");
    if (richTextToPlainText(editing.content).length < 40) return setNotice("Story content must contain at least 40 characters.");
    setSaving(true);
    try {
      let updated = await api(`/api/newsroom/articles/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editing.title, excerpt: editing.excerpt, content: editing.content, categoryId: editing.categoryId }),
      });
      for (const photo of photos) {
        if (photo.id.startsWith("new-") && !photo.removed) {
          updated = await api(`/api/newsroom/articles/${editing.id}/photos`, { method: "POST", body: JSON.stringify({ dataUrl: photo.dataUrl, caption: photo.caption || "" }) });
        } else if (photo.removed && !photo.id.startsWith("new-")) {
          updated = await api(`/api/newsroom/articles/${editing.id}/photos/${photo.id}`, { method: "DELETE" });
        } else if (!photo.removed && (photo.caption || "") !== (photo.originalCaption || "")) {
          updated = await api(`/api/newsroom/articles/${editing.id}/photos/${photo.id}`, { method: "PATCH", body: JSON.stringify({ caption: photo.caption || "" }) });
        }
      }
      setStories((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditing(null);
      setNotice(isAdmin || isEditor ? "Story and photo gallery updated / 新聞及相簿已更新" : "Story updated and returned for review / 新聞已更新並送交審核");
    } catch (error: any) { setNotice(error.message); }
    finally { setSaving(false); }
  };

  const toggleHeadline = async (story: Story) => {
    setHeadlineBusy(story.id);
    try {
      const updated = await api(`/api/articles/${story.id}/headline`, { method: "PATCH", body: JSON.stringify({ isHeadline: !story.isHeadline }) });
      setStories((items) => items.map((item) => item.id === updated.id ? updated : updated.isHeadline ? { ...item, isHeadline: false } : item));
      setNotice(updated.isHeadline ? "Story selected as headline / 新聞已設為頭條" : "Story removed from headline / 新聞已從頭條移除");
    } catch (error: any) { setNotice(error.message); }
    finally { setHeadlineBusy(""); }
  };

  const unpublish = async (story: Story) => {
    if (!window.confirm("Unpublish this story? It will be removed from public news. / 取消發布此新聞？它將從公開新聞中移除。")) return;
    setUnpublishBusy(story.id);
    try {
      const updated = await api(`/api/articles/${story.id}/unpublish`, { method: "PATCH" });
      setStories((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice("Story unpublished and returned to draft / 新聞已取消發布並轉回草稿");
    } catch (error: any) { setNotice(error.message); }
    finally { setUnpublishBusy(""); }
  };

  const roleLabel = current?.user.role === "VOLUNTEER" ? "Reporter / 記者" : current?.user.role;
  const initials = current?.user.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const activePhotos = photos.filter((photo) => !photo.removed);

  return <div className="dash">
    <aside>
      <Link to="/" className="brand light"><span>LN</span><div>LOCAL NEWS<small>NEWSROOM OS</small></div></Link>
      <div className="workspace"><small>WORKSPACE</small><b>Central News Desk</b></div>
      <button onClick={() => nav("/newsroom")}><LayoutDashboard />Overview</button>
      <button className="active"><FileText />Stories<em>{stories.length}</em></button>
      {isAdmin && <button><Users />People</button>}
      {isAdmin && <button><BarChart3 />Analytics</button>}
      <button onClick={() => !isAdmin && nav("/newsroom/settings")}><Settings />Settings</button>
      <div className="profile"><div>{initials}</div><span><b>{current?.user.name}</b><small>{roleLabel}</small></span></div>
    </aside>
    <section className="content storyManagement">
      <div className="top"><div><small>NEWSROOM / STORIES · 新聞中心 / 新聞</small><h1>Story management / 新聞管理</h1><p>Edit story content and manage its photo gallery. / 編輯新聞內容及管理相簿。</p></div>{canCreate && <button className="new" onClick={openStoryComposer}><Plus />New story</button>}</div>
      {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      <div className="panel storyManagerPanel">
        <div className="storyManagerHeader"><span>Photos / 照片</span><span>Story / 新聞</span><span>Status / 狀態</span><span>Updated / 更新</span><span>Action / 操作</span></div>
        {busy && <div className="editorialEmpty">Loading stories… / 正在載入新聞…</div>}
        {!busy && !stories.length && <div className="editorialEmpty">No editable stories. / 暫無可編輯新聞。</div>}
        {!busy && stories.map((story) => {
          const lead = story.photos?.[0]?.url || story.imageUrl;
          return <div className="storyManagerRow" key={story.id}>
            <div className={`storyPhoto ${lead ? "hasPhoto" : ""}`} style={lead ? { backgroundImage: `url(${lead})` } : undefined}>{!lead && <Camera />}<span>{story.photos?.length || 0}</span></div>
            <div className="storyManagerTitle"><b>{story.title}</b><small>{story.author.name} · {story.category.name}</small></div>
            <div className="storyStatus"><span className={`status ${story.status.toLowerCase()}`}>{story.status}</span>{story.isHeadline && <span className="headlineBadge"><Star />Headline / 頭條</span>}</div>
            <time>{new Date(story.updatedAt).toLocaleDateString()}</time>
            <div className="storyActions"><button className="storyEditButton" onClick={() => open(story)}><Pencil />Edit / 編輯</button>{(isAdmin || isEditor) && story.status === "PUBLISHED" && <button className={`headlineButton ${story.isHeadline ? "active" : ""}`} disabled={headlineBusy === story.id} onClick={() => toggleHeadline(story)}><Star />{story.isHeadline ? "Remove headline / 移除頭條" : "Set as headline / 設為頭條"}</button>}{story.status === "PUBLISHED" && <button className="unpublishButton" disabled={unpublishBusy === story.id} onClick={() => unpublish(story)}><EyeOff />Unpublish / 取消發布</button>}</div>
          </div>;
        })}
      </div>
    </section>
    {editing && <div className="modalBackdrop" onMouseDown={() => setEditing(null)}>
      <form className="userModal storyEditorModal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modalHead"><div><small>EDIT STORY · 編輯新聞</small><h2>{editing.title}</h2></div><button type="button" onClick={() => setEditing(null)}><X /></button></div>
        <section className="storyGalleryEditor">
          <div className="storyGalleryHeading"><div><b>Story photos and captions / 新聞照片及說明</b><p>Up to 12 PNG, JPEG or WebP photos · maximum 5 MB each</p></div><button type="button" onClick={() => fileRef.current?.click()}><ImagePlus />Add photos / 新增照片</button></div>
          <input ref={fileRef} hidden multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectPhotos(event.target.files)} />
          {!activePhotos.length && <div className="emptyPhotoGallery"><ImagePlus /><span>No photos yet / 尚未有照片</span></div>}
          <div className="storyGalleryGrid">{activePhotos.map((photo, index) => <div className="storyGalleryItem" key={photo.id}>
            <div style={{ backgroundImage: `url(${photo.dataUrl || photo.url})` }}><span>{index + 1}</span></div>
            <label>Caption / 圖片說明<textarea maxLength={240} rows={2} placeholder="Describe this photo / 說明這張照片" value={photo.caption || ""} onChange={(event) => setPhotos((items) => items.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item))} /></label>
            <button type="button" onClick={() => setPhotos((items) => items.map((item) => item.id === photo.id ? { ...item, removed: true } : item))}><Trash2 />Remove / 移除</button>
          </div>)}</div>
        </section>
        <label>Story title / 新聞標題<input required minLength={8} maxLength={180} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
        <label>News category / 新聞類別<select value={editing.categoryId} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <div className="storyRichTextField"><span>Summary / 摘要</span><RichTextEditor compact label="Summary / 摘要" placeholder="Write a short story summary…" minLength={20} maxLength={600} value={editing.excerpt} onChange={(excerpt) => setEditing((current) => current ? { ...current, excerpt } : current)} /></div>
        <div className="storyRichTextField"><span>Story content / 新聞內容</span><RichTextEditor label="Story content / 新聞內容" placeholder="Write the full story…" minLength={40} value={editing.content} onChange={(content) => setEditing((current) => current ? { ...current, content } : current)} /></div>
        <div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Cancel / 取消</button><button className="new" disabled={saving}><Save />{saving ? "Saving…" : "Save changes / 儲存變更"}</button></div>
      </form>
    </div>}
  </div>;
}
