import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Camera,
  FileText,
  Eye,
  EyeOff,
  ImagePlus,
  LayoutDashboard,
  Link2,
  Pencil,
  Plus,
  Save,
  Settings,
  Star,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import "./story-url-preview.css";
import "./story-media.css";
import "./story-preview.css";
import { firstHttpUrl, isVideoUrl, linkifyRichText, previewImageForUrl, richTextToPlainText } from "./richTextUtils";
import { openStoryComposer } from "./StoryComposer";

type Category = { id: string; name: string };
type StoryPhoto = { id: string; url: string; caption: string | null; sortOrder: number; mediaType?: "IMAGE" | "VIDEO" };
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
  storyDate?: string | null;
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
  const maxMediaItems = isAdmin || isEditor ? 50 : 12;
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
  const editingRef = useRef<Story | null>(null);
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
    editingRef.current = { ...story, storyDate: story.storyDate?.slice(0, 10) || null };
    setEditing(editingRef.current);
    setPhotos((story.photos || []).map((photo) => ({ ...photo, originalCaption: photo.caption || "" })));
  };

  const updateEditing = (changes: Partial<Story>) => {
    if (!editingRef.current) return;
    editingRef.current = { ...editingRef.current, ...changes };
    setEditing(editingRef.current);
  };

  const closeEditor = () => {
    editingRef.current = null;
    setEditing(null);
  };

  const selectPhotos = async (files?: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const activeCount = photos.filter((photo) => !photo.removed).length;
    if (activeCount + incoming.length > maxMediaItems) return setNotice(`A story can have up to ${maxMediaItems} photos or videos / 每篇新聞最多可有 ${maxMediaItems} 個照片或影片`);
    for (const file of incoming) {
      const isImage = /^image\/(png|jpeg|webp)$/.test(file.type);
      const isVideo = /^video\/(mp4|webm|quicktime)$/.test(file.type);
      if (!isImage && !isVideo) return setNotice("Use PNG, JPEG, WebP, MP4, WebM or MOV files / 請使用支援的照片或影片格式");
      if (isImage && file.size > 5 * 1024 * 1024) return setNotice("Each photo must be 5 MB or smaller / 每張照片不得超過 5 MB");
      if (isVideo && file.size > 25 * 1024 * 1024) return setNotice("Each video must be 25 MB or smaller / 每個影片不得超過 25 MB");
    }
    const additions = await Promise.all(incoming.map(async (file, index): Promise<EditablePhoto> => ({
      id: `new-${crypto.randomUUID()}`,
      url: "",
      dataUrl: await fileToDataUrl(file),
      caption: "",
      sortOrder: activeCount + index,
      originalCaption: "",
      mediaType: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
    })));
    setPhotos((items) => [...items, ...additions]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const draft = editingRef.current;
    if (!draft) return;
    const form = event.currentTarget as HTMLFormElement;
    const currentEditorHtml = (fieldName: string, fallback: string) =>
      form.querySelector<HTMLElement>(`[data-rich-text-field="${fieldName}"]`)?.innerHTML || fallback;
    const excerpt = linkifyRichText(currentEditorHtml("excerpt", draft.excerpt));
    const content = linkifyRichText(currentEditorHtml("content", draft.content));
    if (richTextToPlainText(excerpt).length < 10) return setNotice("Summary must contain at least 10 characters.");
    if (richTextToPlainText(excerpt).length > 600) return setNotice("Summary must contain no more than 600 characters.");
    if (richTextToPlainText(content).length < 20) return setNotice("Story content must contain at least 20 characters.");
    setSaving(true);
    try {
      let updated = await api(`/api/newsroom/articles/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: draft.title, excerpt, content, categoryId: draft.categoryId, storyDate: draft.storyDate || null }),
      });
      for (const photo of photos) {
        if (photo.id.startsWith("new-") && !photo.removed) {
          updated = await api(`/api/newsroom/articles/${draft.id}/photos`, { method: "POST", body: JSON.stringify({ dataUrl: photo.dataUrl, caption: photo.caption || "" }) });
        } else if (photo.removed && !photo.id.startsWith("new-")) {
          updated = await api(`/api/newsroom/articles/${draft.id}/photos/${photo.id}`, { method: "DELETE" });
        } else if (!photo.removed && (photo.caption || "") !== (photo.originalCaption || "")) {
          updated = await api(`/api/newsroom/articles/${draft.id}/photos/${photo.id}`, { method: "PATCH", body: JSON.stringify({ caption: photo.caption || "" }) });
        }
      }
      setStories((items) => items.map((item) => item.id === updated.id ? updated : item));
      closeEditor();
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
  const editingContentUrl = editing ? firstHttpUrl(editing.content) : null;
  const editingContentPreviewUrl = editingContentUrl ? previewImageForUrl(editingContentUrl) : null;

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
          const contentUrl = firstHttpUrl(story.content);
          const contentPreviewUrl = contentUrl ? previewImageForUrl(contentUrl) : null;
          const galleryImage = story.photos?.find((media) => !isVideoUrl(media.url))?.url;
          const hasVideo = story.photos?.some((media) => isVideoUrl(media.url));
          const lead = galleryImage || story.imageUrl || contentPreviewUrl;
          const usesContentUrl = Boolean(contentPreviewUrl && !galleryImage && !story.imageUrl);
          return <div className="storyManagerRow" key={story.id}>
            <div className={`storyPhoto ${lead ? "hasPhoto" : ""} ${usesContentUrl ? "contentUrlPhoto" : ""}`} style={lead ? { backgroundImage: `url(${lead})` } : undefined} title={usesContentUrl ? "Preview from the first URL in story content" : hasVideo && !lead ? "Story contains video" : undefined}>{!lead && (hasVideo ? <Video /> : <Camera />)}{usesContentUrl && <Link2 />}<span>{story.photos?.length || 0}</span></div>
            <div className="storyManagerTitle"><b>{story.title}</b><small>{story.author.name} · {story.category.name}{story.storyDate ? ` · ${new Date(story.storyDate).toLocaleDateString()}` : ""}</small></div>
            <div className="storyStatus"><span className={`status ${story.status.toLowerCase()}`}>{story.status}</span>{story.isHeadline && <span className="headlineBadge"><Star />Headline / 頭條</span>}</div>
            <time>{new Date(story.updatedAt).toLocaleDateString()}</time>
            <div className="storyActions"><Link className="storyPreviewButton" to={`/newsroom/stories/${story.id}/preview`} target="_blank" rel="noopener noreferrer"><Eye />Preview / 預覽</Link><button className="storyEditButton" onClick={() => open(story)}><Pencil />Edit / 編輯</button>{(isAdmin || isEditor) && story.status === "PUBLISHED" && <button className={`headlineButton ${story.isHeadline ? "active" : ""}`} disabled={headlineBusy === story.id} onClick={() => toggleHeadline(story)}><Star />{story.isHeadline ? "Remove headline / 移除頭條" : "Set as headline / 設為頭條"}</button>}{story.status === "PUBLISHED" && <button className="unpublishButton" disabled={unpublishBusy === story.id} onClick={() => unpublish(story)}><EyeOff />Unpublish / 取消發布</button>}</div>
          </div>;
        })}
      </div>
    </section>
    {editing && <div className="modalBackdrop" onMouseDown={closeEditor}>
      <form className="userModal storyEditorModal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modalHead"><div><small>EDIT STORY · 編輯新聞</small><h2>{editing.title}</h2></div><button type="button" onClick={closeEditor}><X /></button></div>
        <section className="storyGalleryEditor">
          <div className="storyGalleryHeading"><div><b>Story photos, videos and captions / 新聞照片、影片及說明</b><p>Up to {maxMediaItems} items · photos 5 MB · videos 25 MB</p></div><button type="button" onClick={() => fileRef.current?.click()}><ImagePlus />Add media / 新增媒體</button></div>
          <input ref={fileRef} hidden multiple type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.mov" onChange={(event) => selectPhotos(event.target.files)} />
          {!activePhotos.length && editingContentUrl && <div className="contentUrlPreview">
            <div className={editingContentPreviewUrl ? "hasPreviewImage" : ""} style={editingContentPreviewUrl ? { backgroundImage: `url(${editingContentPreviewUrl})` } : undefined}><Link2 /></div>
            <span><b>Preview from story content / 內容連結預覽</b><a href={editingContentUrl} target="_blank" rel="noopener noreferrer">{editingContentUrl}</a></span>
          </div>}
          {!activePhotos.length && !editingContentUrl && <div className="emptyPhotoGallery"><ImagePlus /><span>No photos or videos yet / 尚未有照片或影片</span></div>}
          <div className="storyGalleryGrid">{activePhotos.map((photo, index) => <div className="storyGalleryItem" key={photo.id}>
            {photo.mediaType === "VIDEO" || isVideoUrl(photo.url) ? <div className="storyVideoPreview"><video src={photo.dataUrl || photo.url} controls preload="metadata" /><span>{index + 1}</span><Video /></div> : <div style={{ backgroundImage: `url(${photo.dataUrl || photo.url})` }}><span>{index + 1}</span></div>}
            <label>Caption / 媒體說明<textarea maxLength={240} rows={2} placeholder="Describe this photo or video / 說明這個照片或影片" value={photo.caption || ""} onChange={(event) => setPhotos((items) => items.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item))} /></label>
            <button type="button" onClick={() => setPhotos((items) => items.map((item) => item.id === photo.id ? { ...item, removed: true } : item))}><Trash2 />Remove / 移除</button>
          </div>)}</div>
        </section>
        <label>Story title / 新聞標題<input required minLength={8} maxLength={180} value={editing.title} onChange={(event) => updateEditing({ title: event.target.value })} /></label>
        <label>News category / 新聞類別<select value={editing.categoryId} onChange={(event) => updateEditing({ categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Story / event date / 新聞或活動日期<input type="date" value={editing.storyDate || ""} onChange={(event) => updateEditing({ storyDate: event.target.value || null })} /></label>
        <div className="storyRichTextField"><span>Summary / 摘要</span><RichTextEditor compact fieldName="excerpt" label="Summary / 摘要" placeholder="Write a short story summary…" minLength={10} maxLength={600} value={editing.excerpt} onChange={(excerpt) => updateEditing({ excerpt })} /></div>
        <div className="storyRichTextField"><span>Story content / 新聞內容</span><RichTextEditor fieldName="content" label="Story content / 新聞內容" placeholder="Write the full story…" minLength={20} value={editing.content} onChange={(content) => updateEditing({ content })} /></div>
        <div className="modalActions"><button type="button" onClick={closeEditor}>Cancel / 取消</button><button className="new" disabled={saving}><Save />{saving ? "Saving…" : "Save changes / 儲存變更"}</button></div>
      </form>
    </div>}
  </div>;
}
