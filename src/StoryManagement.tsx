import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Camera,
  FileText,
  ImagePlus,
  LayoutDashboard,
  Pencil,
  Plus,
  Save,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";

type Category = { id: string; name: string };
type Story = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  status: string;
  imageUrl: string | null;
  updatedAt: string;
  author: { name: string };
  category: Category;
  categoryId: string;
};
type Session = { token: string; user: { name: string; role: string } };

const session = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem("ln_session") || "null");
  } catch {
    return null;
  }
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
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
  const [photoData, setPhotoData] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const headers = useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${current?.token || ""}` }),
    [current?.token],
  );

  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };

  const load = async () => {
    setBusy(true);
    try {
      const [items, options] = await Promise.all([
        api("/api/newsroom/articles"),
        api("/api/story-options"),
      ]);
      setStories(items);
      setCategories(options.categories);
      setCanCreate(Boolean(options.canCreate));
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    const reload = () => load();
    window.addEventListener("localnews:story-created", reload);
    return () => window.removeEventListener("localnews:story-created", reload);
  }, []);

  const open = (story: Story) => {
    setEditing({ ...story });
    setPhotoData("");
    setRemovePhoto(false);
  };

  const selectPhoto = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setNotice("Use a PNG, JPEG or WebP photo");
    if (file.size > 5 * 1024 * 1024) return setNotice("Story photo must be 5 MB or smaller");
    setPhotoData(await fileToDataUrl(file));
    setRemovePhoto(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      let updated = await api(`/api/newsroom/articles/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editing.title,
          excerpt: editing.excerpt,
          content: editing.content,
          categoryId: editing.categoryId,
        }),
      });
      if (photoData) {
        updated = await api(`/api/newsroom/articles/${editing.id}/image`, {
          method: "POST",
          body: JSON.stringify({ dataUrl: photoData }),
        });
      } else if (removePhoto && editing.imageUrl) {
        updated = await api(`/api/newsroom/articles/${editing.id}/image`, { method: "DELETE" });
      }
      setStories((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      setNotice(
        isAdmin || isEditor
          ? "Story updated / 新聞已更新"
          : "Story updated and returned for review / 新聞已更新並送交審核",
      );
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = current?.user.role === "VOLUNTEER" ? "Reporter / 記者" : current?.user.role;
  const initials = current?.user.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const preview = photoData || (removePhoto ? "" : editing?.imageUrl || "");

  return (
    <div className="dash">
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
        <div className="top">
          <div><small>NEWSROOM / STORIES · 新聞中心 / 新聞</small><h1>Story management / 新聞管理</h1><p>Edit story content and manage its photo. / 編輯新聞內容及管理照片。</p></div>
          {canCreate && <button className="new"><Plus />New story</button>}
        </div>
        {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        <div className="panel storyManagerPanel">
          <div className="storyManagerHeader"><span>Photo / 照片</span><span>Story / 新聞</span><span>Status / 狀態</span><span>Updated / 更新</span><span>Action / 操作</span></div>
          {busy && <div className="editorialEmpty">Loading stories… / 正在載入新聞…</div>}
          {!busy && !stories.length && <div className="editorialEmpty">No editable stories. / 暫無可編輯新聞。</div>}
          {!busy && stories.map((story) => (
            <div className="storyManagerRow" key={story.id}>
              <div className={`storyPhoto ${story.imageUrl ? "hasPhoto" : ""}`} style={story.imageUrl ? { backgroundImage: `url(${story.imageUrl})` } : undefined}>{!story.imageUrl && <Camera />}</div>
              <div className="storyManagerTitle"><b>{story.title}</b><small>{story.author.name} · {story.category.name}</small></div>
              <span className={`status ${story.status.toLowerCase()}`}>{story.status}</span>
              <time>{new Date(story.updatedAt).toLocaleDateString()}</time>
              <button className="storyEditButton" onClick={() => open(story)}><Pencil />Edit / 編輯</button>
            </div>
          ))}
        </div>
      </section>
      {editing && (
        <div className="modalBackdrop" onMouseDown={() => setEditing(null)}>
          <form className="userModal storyEditorModal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><small>EDIT STORY · 編輯新聞</small><h2>{editing.title}</h2></div><button type="button" onClick={() => setEditing(null)}><X /></button></div>
            <div className="storyPhotoEditor">
              <div className={preview ? "hasPhoto" : ""} style={preview ? { backgroundImage: `url(${preview})` } : undefined}>{!preview && <ImagePlus />}</div>
              <section><b>Story photo / 新聞照片</b><p>PNG, JPEG or WebP · maximum 5 MB</p><span><button type="button" onClick={() => fileRef.current?.click()}><ImagePlus />{preview ? "Replace photo" : "Upload photo"}</button>{preview && <button type="button" className="removeStoryPhoto" onClick={() => { setPhotoData(""); setRemovePhoto(true); }}><Trash2 />Remove</button>}</span></section>
              <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectPhoto(event.target.files?.[0])} />
            </div>
            <label>Story title / 新聞標題<input required minLength={8} maxLength={180} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
            <label>News category / 新聞類別<select value={editing.categoryId} onChange={(event) => setEditing({ ...editing, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>Summary / 摘要<textarea required minLength={20} rows={3} value={editing.excerpt} onChange={(event) => setEditing({ ...editing, excerpt: event.target.value })} /></label>
            <label>Story content / 新聞內容<textarea required minLength={40} rows={9} value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} /></label>
            <div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Cancel / 取消</button><button className="new" disabled={saving}><Save />{saving ? "Saving…" : "Save changes / 儲存變更"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
