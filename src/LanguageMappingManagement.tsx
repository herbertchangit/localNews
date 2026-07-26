import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Check,
  FileText,
  Languages,
  LayoutDashboard,
  Network,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Settings,
  Tag,
  Users,
  X,
} from "lucide-react";
import { DEFAULT_TRANSLATION_MAPPINGS, TranslationMapping } from "./I18n";

type EditableMapping = TranslationMapping & { overridden: boolean };
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");

export default function LanguageMappingManagement() {
  const nav = useNavigate();
  const [overrides, setOverrides] = useState<TranslationMapping[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Pick<TranslationMapping, "zhCn" | "zhTw">>>({});
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState("");
  const [adding, setAdding] = useState<TranslationMapping | null>(null);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session()?.token}` };
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const load = () => api("/api/admin/translations")
    .then((items: TranslationMapping[]) => setOverrides(items))
    .catch((error: Error) => setNotice(error.message))
    .finally(() => setBusy(false));
  useEffect(() => { load(); }, []);

  const rows = useMemo<EditableMapping[]>(() => {
    const defaults = new Map(DEFAULT_TRANSLATION_MAPPINGS.map((item) => [item.source, item]));
    overrides.forEach((item) => defaults.set(item.source, item));
    const overrideKeys = new Set(overrides.map((item) => item.source));
    return [...defaults.values()]
      .map((item) => ({ ...item, overridden: overrideKeys.has(item.source) }))
      .filter((item) => `${item.source} ${item.zhCn} ${item.zhTw}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.source.localeCompare(b.source));
  }, [overrides, query]);
  const values = (item: EditableMapping) => drafts[item.source] || item;
  const updateDraft = (item: EditableMapping, field: "zhCn" | "zhTw", value: string) =>
    setDrafts((current) => ({ ...current, [item.source]: { zhCn: values(item).zhCn, zhTw: values(item).zhTw, [field]: value } }));
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const save = async (mapping: TranslationMapping) => {
    setSaving(mapping.source);
    try {
      const saved = await api("/api/admin/translations", { method: "POST", body: JSON.stringify(mapping) });
      setOverrides((current) => [...current.filter((item) => item.source !== saved.source), saved]);
      setDrafts((current) => { const next = { ...current }; delete next[mapping.source]; return next; });
      window.dispatchEvent(new Event("localnews:translations-updated"));
      flash("Language mapping updated");
    } catch (error: any) { flash(error.message); }
    finally { setSaving(""); }
  };
  const reset = async (item: EditableMapping) => {
    if (!item.overridden || !window.confirm(`Restore the built-in translation for “${item.source}”?`)) return;
    setSaving(item.source);
    try {
      await api("/api/admin/translations", { method: "DELETE", body: JSON.stringify({ source: item.source }) });
      setOverrides((current) => current.filter((mapping) => mapping.source !== item.source));
      setDrafts((current) => { const next = { ...current }; delete next[item.source]; return next; });
      window.dispatchEvent(new Event("localnews:translations-updated"));
      flash("Built-in language mapping restored");
    } catch (error: any) { flash(error.message); }
    finally { setSaving(""); }
  };
  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!adding) return;
    await save(adding);
    setAdding(null);
  };
  const initials = session()?.user?.name?.split(" ").map((part: string) => part[0]).slice(0, 2).join("") || "AD";

  return <div className="dash languageMappingManagement"><aside>
    <Link to="/" className="brand light"><span>LN</span><div>LOCAL NEWS<small>NEWSROOM OS</small></div></Link>
    <div className="workspace"><small>WORKSPACE</small><b>Central News Desk</b></div>
    <button onClick={() => nav("/newsroom")}><LayoutDashboard />Overview</button>
    <button onClick={() => nav("/newsroom/stories")}><FileText />Stories</button>
    <button onClick={() => nav("/newsroom/users")}><Users />People</button>
    <button><BarChart3 />Analytics</button>
    <button className="settingsParentButton"><Settings />Settings</button>
    <button className="settingsSubnavButton" onClick={() => nav("/newsroom/departments")}><Building2 />Organizations</button>
    <button className="settingsSubnavButton" onClick={() => nav("/newsroom/org-chart")}><Network />Organization Chart</button>
    <button className="settingsSubnavButton" onClick={() => nav("/newsroom/categories")}><Tag />News Categories</button>
    <button className="settingsSubnavButton" onClick={() => nav("/newsroom/jingsi")}><Quote />JingSi / 靜思</button>
    <button className="settingsSubnavButton active"><Languages />Language Mapping</button>
    <div className="profile sidebarProfileLast"><div>{initials}</div><span><b>{session()?.user?.name || "Administrator"}</b><small>Administrator</small></span></div>
  </aside><section className="content languageMappingPage">
    <div className="top"><div><small>SETTINGS / LANGUAGE MAPPING</small><h1>Language Mapping</h1><p>Modify the simplified and traditional Chinese labels used across every page.</p></div><button className="new" onClick={() => setAdding({ source: "", zhCn: "", zhTw: "" })}><Plus />Add Mapping</button></div>
    {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}><X /></button></div>}
    <div className="languageMappingSummary"><div><Languages /><span><b>{DEFAULT_TRANSLATION_MAPPINGS.length}</b><small>Built-in mappings</small></span></div><div><Check /><span><b>{overrides.length}</b><small>Admin overrides</small></span></div></div>
    <div className="panel languageMappingPanel">
      <div className="languageMappingTools"><div className="userSearch"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search English or Chinese labels" /></div><span>{rows.length} mappings</span></div>
      <div className="languageMappingTable">
        <div className="languageMappingRow languageMappingHeader"><span>English source</span><span>简体中文</span><span>繁體中文</span><span>Actions</span></div>
        {busy ? <div className="emptyState">Loading language mappings…</div> : rows.map((item) => {
          const current = values(item), changed = Boolean(drafts[item.source]);
          return <div className={`languageMappingRow${item.overridden ? " isOverridden" : ""}`} key={item.source}>
            <div className="languageSource"><b>{item.source}</b><small>{item.overridden ? "Admin override" : "Built in"}</small></div>
            <input aria-label={`Simplified Chinese for ${item.source}`} value={current.zhCn} onChange={(event) => updateDraft(item, "zhCn", event.target.value)} />
            <input aria-label={`Traditional Chinese for ${item.source}`} value={current.zhTw} onChange={(event) => updateDraft(item, "zhTw", event.target.value)} />
            <div className="languageMappingActions"><button title="Save mapping" disabled={!changed || saving === item.source || !current.zhCn.trim() || !current.zhTw.trim()} onClick={() => save({ source: item.source, ...current })}><Check /></button><button title="Restore built-in mapping" disabled={!item.overridden || saving === item.source} onClick={() => reset(item)}><RotateCcw /></button></div>
          </div>;
        })}
      </div>
    </div>
  </section>{adding && <div className="modalBackdrop" onMouseDown={() => setAdding(null)}><form className="userModal languageMappingModal" onSubmit={add} onMouseDown={(event) => event.stopPropagation()}><div className="modalHead"><div><small>NEW TRANSLATION</small><h2>Add Language Mapping</h2></div><button type="button" onClick={() => setAdding(null)}><X /></button></div><label>English source<input autoFocus required maxLength={500} value={adding.source} onChange={(event) => setAdding({ ...adding, source: event.target.value })} /></label><label>简体中文<input required maxLength={1000} value={adding.zhCn} onChange={(event) => setAdding({ ...adding, zhCn: event.target.value })} /></label><label>繁體中文<input required maxLength={1000} value={adding.zhTw} onChange={(event) => setAdding({ ...adding, zhTw: event.target.value })} /></label><p>The English source must exactly match the label used by the application.</p><div className="modalActions"><button type="button" onClick={() => setAdding(null)}>Cancel</button><button className="new" disabled={Boolean(saving)}>Save Mapping</button></div></form></div>}</div>;
}
