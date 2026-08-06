import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, FileText, LayoutDashboard, MapPinned, Pencil, Plus, Search, Settings, Trash2, Users, X } from "lucide-react";

type MutualLove = { id: string; name: string };
type Harmony = { id: string; name: string; mutualLoves: MutualLove[] };
type Area = {
  id: string;
  name: string;
  mutualLoveId: string;
  mutualLove: MutualLove & { harmony: { id: string; name: string } };
};
type AreaEditor = { id?: string; name: string; mutualLoveId: string };

const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");

export default function AreaManagement() {
  const nav = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [structure, setStructure] = useState<Harmony[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AreaEditor | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session()?.token}` };
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const load = async () => {
    try {
      const [areaItems, hierarchy] = await Promise.all([api("/api/admin/areas"), api("/api/org-structure-options")]);
      setAreas(areaItems);
      setStructure(hierarchy);
    } catch (error: any) { setNotice(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => areas.filter((area) => `${area.name} ${area.mutualLove.name} ${area.mutualLove.harmony.name}`.toLowerCase().includes(query.toLowerCase())), [areas, query]);
  const firstMutualLoveId = structure.flatMap((harmony) => harmony.mutualLoves)[0]?.id || "";
  const openNew = () => setEditing({ name: "", mutualLoveId: firstMutualLoveId });
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const area = await api(editing.id ? `/api/admin/areas/${editing.id}` : "/api/admin/areas", { method: editing.id ? "PATCH" : "POST", body: JSON.stringify({ name: editing.name, mutualLoveId: editing.mutualLoveId }) });
      setAreas((current) => (editing.id ? current.map((item) => item.id === area.id ? area : item) : [...current, area]).sort((a, b) => a.name.localeCompare(b.name)));
      setEditing(null);
      flash(editing.id ? "Area updated" : "Area created");
    } catch (error: any) { flash(error.message); }
    finally { setSaving(false); }
  };
  const remove = async (area: Area) => {
    if (!confirm(`Delete ${area.name}?`)) return;
    try {
      await api(`/api/admin/areas/${area.id}`, { method: "DELETE" });
      setAreas((current) => current.filter((item) => item.id !== area.id));
      flash("Area deleted");
    } catch (error: any) { flash(error.message); }
  };
  const assignedMutualLoves = new Set(areas.map((area) => area.mutualLoveId)).size;

  return <div className="dash areaManagement"><aside><Link to="/" className="brand light"><span>LN</span><div>LOCAL NEWS<small>NEWSROOM OS</small></div></Link><div className="workspace"><small>WORKSPACE</small><b>{session()?.user?.name}</b></div><button onClick={() => nav("/newsroom/stories")}><LayoutDashboard/>Overview</button><button onClick={() => nav("/newsroom/stories")}><FileText/>Stories</button><button onClick={() => nav("/newsroom/users")}><Users/>People</button><button disabled><BarChart3/>Analytics</button><button onClick={() => nav("/newsroom/settings")}><Settings/>Settings</button></aside><section className="content areaPage"><div className="top"><div><small>SETTINGS / AREAS</small><h1>Area management</h1><p>Create areas and assign each one to a MutualLove group from the Organization Chart.</p></div><button className="new" disabled={!firstMutualLoveId} onClick={openNew}><Plus/>Add area</button></div>{notice&&<div className="toast">{notice}<button onClick={() => setNotice("")}><X/></button></div>}<div className="areaSummary"><div><span><MapPinned/></span><b>{areas.length}</b><small>Total areas</small></div><div><span><Users/></span><b>{assignedMutualLoves}</b><small>MutualLove groups assigned</small></div></div><div className="panel areaPanel"><div className="areaTools"><label><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search areas or MutualLove" aria-label="Search areas"/></label><span>{filtered.length} areas</span></div><div className="areaTable"><div className="areaRow areaHeader"><span>Area name</span><span>Harmony</span><span>MutualLove</span><span>Actions</span></div>{loading?<div className="emptyState">Loading areas…</div>:filtered.map((area) => <div className="areaRow" key={area.id}><div className="areaIdentity"><span><MapPinned/></span><b>{area.name}</b></div><span>{area.mutualLove.harmony.name}</span><strong>{area.mutualLove.name}</strong><div className="areaActions"><button title={`Edit ${area.name}`} aria-label={`Edit ${area.name}`} onClick={() => setEditing({ id: area.id, name: area.name, mutualLoveId: area.mutualLoveId })}><Pencil/></button><button className="danger" title={`Delete ${area.name}`} aria-label={`Delete ${area.name}`} onClick={() => remove(area)}><Trash2/></button></div></div>)}{!loading&&!filtered.length&&<div className="emptyState">No areas found.</div>}</div></div>{!firstMutualLoveId&&<p className="areaWarning">Create a MutualLove group in Organization Chart before adding an area.</p>}</section>{editing&&<div className="modalBackdrop" onMouseDown={() => setEditing(null)}><form className="userModal areaModal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><div className="modalHead"><div><small>{editing.id?"EDIT AREA":"NEW AREA"}</small><h2>{editing.id?"Update area":"Create area"}</h2></div><button type="button" aria-label="Close" onClick={() => setEditing(null)}><X/></button></div><label>Area name<input autoFocus required minLength={2} maxLength={120} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="e.g. Bandar Puteri"/></label><label>MutualLove<select required value={editing.mutualLoveId} onChange={(event) => setEditing({ ...editing, mutualLoveId: event.target.value })}>{structure.map((harmony) => <optgroup label={harmony.name} key={harmony.id}>{harmony.mutualLoves.map((mutualLove) => <option value={mutualLove.id} key={mutualLove.id}>{mutualLove.name}</option>)}</optgroup>)}</select></label><div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="new" type="submit" disabled={saving}>{saving?"Saving…":editing.id?"Save changes":"Create area"}</button></div></form></div>}</div>;
}
