import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Clock,
  FileText,
  LayoutDashboard,
  Network,
  Pencil,
  Plus,
  Quote,
  Radio,
  Settings,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";

type JingSiMessage = { id: string; content: string; createdAt: string; updatedAt: string };
type Editor = { id?: string; content: string };
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");

export default function JingSiManagement() {
  const nav = useNavigate();
  const [items, setItems] = useState<JingSiMessage[]>([]);
  const [editing, setEditing] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session()?.token}` };
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const load = () => api("/api/admin/jingsi")
    .then(setItems)
    .catch((error: Error) => setNotice(error.message))
    .finally(() => setBusy(false));

  useEffect(() => { load(); }, []);
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const message = await api(editing.id ? `/api/admin/jingsi/${editing.id}` : "/api/admin/jingsi", {
        method: editing.id ? "PATCH" : "POST",
        body: JSON.stringify({ content: editing.content }),
      });
      setItems((current) => editing.id
        ? current.map((item) => item.id === message.id ? message : item)
        : [message, ...current]);
      setEditing(null);
      window.dispatchEvent(new CustomEvent("localnews:jingsi-updated"));
      flash(editing.id ? "JingSi message updated / 靜思語已更新" : "JingSi message published / 靜思語已發布");
    } catch (error: any) { flash(error.message); }
    finally { setSaving(false); }
  };
  const remove = async (item: JingSiMessage) => {
    if (!window.confirm("Delete this JingSi message? / 刪除此靜思語？")) return;
    try {
      await api(`/api/admin/jingsi/${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((message) => message.id !== item.id));
      window.dispatchEvent(new CustomEvent("localnews:jingsi-updated"));
      flash("JingSi message deleted / 靜思語已刪除");
    } catch (error: any) { flash(error.message); }
  };

  const current = items[0];
  const initials = session()?.user?.name?.split(" ").map((part: string) => part[0]).slice(0, 2).join("") || "AD";
  return <div className="dash jingSiManagement"><aside>
    <Link to="/" className="brand light"><span>LN</span><div>LOCAL NEWS<small>NEWSROOM OS</small></div></Link>
    <div className="workspace"><small>WORKSPACE / 工作區</small><b>Central News Desk</b></div>
    <button onClick={() => nav("/newsroom")}><LayoutDashboard />Overview / 總覽</button>
    <button onClick={() => nav("/newsroom/stories")}><FileText />Stories / 新聞</button>
    <button onClick={() => nav("/newsroom/users")}><Users />People / 人員</button>
    <button><BarChart3 />Analytics / 分析</button>
    <button className="settingsParentButton" onClick={() => nav("/newsroom/settings")}><Settings />Settings / 設定</button>
    <button className="settingsSubnavButton" onClick={() => nav("/newsroom/departments")}><Building2 />Organizations / 志業／角色</button>
    <button className="settingsSubnavButton" onClick={() => nav("/newsroom/org-chart")}><Network />Organization Chart / 組織圖</button>
    <button className="settingsSubnavButton" onClick={() => nav("/newsroom/categories")}><Tag />News Categories / 新聞類別</button>
    <button className="settingsSubnavButton active"><Quote />JingSi / 靜思</button>
    <div className="profile sidebarProfileLast"><div>{initials}</div><span><b>{session()?.user?.name || "Administrator"}</b><small>Administrator / 管理員</small></span></div>
  </aside><section className="content jingSiPage">
    <div className="top"><div><small>SETTINGS / JINGSI · 設定 / 靜思</small><h1>JingSi Message Management / 靜思語管理</h1><p>Add and maintain the wisdom message shown across the public site. / 新增及維護公開網站顯示的靜思語。</p></div><button className="new" onClick={() => setEditing({ content: "" })}><Plus />Add Message / 新增靜思語</button></div>
    {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}><X /></button></div>}
    <section className="jingSiCurrent panel">
      <div><span><Radio /></span><div><small>LIVE NOW / 現正顯示</small><h2>Latest message publishes automatically</h2></div></div>
      {busy ? <p>Loading JingSi message… / 正在載入靜思語…</p> : current ? <><blockquote>{current.content}</blockquote><time><Clock />Onboarded {new Date(current.createdAt).toLocaleString()}</time></> : <p>No JingSi message available.</p>}
    </section>
    <div className="panel jingSiPanel"><div className="jingSiPanelHead"><div><h2>Message history / 靜思語記錄</h2><p>The newest onboarded message is always published to the JingSi strip. / 最新新增的靜思語會自動發布至靜思語橫幅。</p></div><strong>{items.length}</strong></div>
      <div className="jingSiList">{!busy && items.map((item, index) => <article className={index === 0 ? "isLive" : ""} key={item.id}><span className="jingSiQuote"><Quote /></span><div><div className="jingSiMeta">{index === 0 && <b><Radio />LIVE / 顯示中</b>}<time>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.content}</p>{item.updatedAt !== item.createdAt && <small>Updated / 更新：{new Date(item.updatedAt).toLocaleString()}</small>}</div><div className="jingSiActions"><button aria-label="Edit JingSi message" title="Edit / 編輯" onClick={() => setEditing({ id: item.id, content: item.content })}><Pencil /></button><button className="danger" aria-label="Delete JingSi message" title="Delete / 刪除" disabled={items.length === 1} onClick={() => remove(item)}><Trash2 /></button></div></article>)}
      {busy && <div className="emptyState">Loading messages… / 正在載入靜思語…</div>}</div>
    </div>
  </section>{editing && <div className="modalBackdrop" onMouseDown={() => setEditing(null)}><form className="userModal jingSiModal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className="modalHead"><div><small>{editing.id ? "EDIT JINGSI / 編輯靜思語" : "NEW JINGSI / 新增靜思語"}</small><h2>{editing.id ? "Edit JingSi Message / 編輯靜思語" : "Publish JingSi Message / 發布靜思語"}</h2></div><button type="button" aria-label="Close" onClick={() => setEditing(null)}><X /></button></div><label>Message / 靜思語<textarea autoFocus required minLength={2} maxLength={500} rows={7} value={editing.content} onChange={(event) => setEditing({ ...editing, content: event.target.value })} placeholder="Enter the daily JingSi message… / 輸入每日靜思語…" /></label><div className="jingSiCharacterCount">{editing.content.length} / 500</div><p>{editing.id ? "The live strip updates immediately when this is the newest message. / 若此為最新靜思語，橫幅會立即更新。" : "This becomes the live JingSi message immediately after saving. / 儲存後將立即成為顯示中的靜思語。"}</p><div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Cancel / 取消</button><button className="new" disabled={saving}>{saving ? "Saving… / 儲存中…" : editing.id ? "Save Changes / 儲存變更" : "Publish Message / 發布靜思語"}</button></div></form></div>}</div>;
}
