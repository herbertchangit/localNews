import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, Check, FileText, LayoutDashboard, Pencil, Plus, Search, Settings, ShieldCheck, Trash2, Users, X } from "lucide-react";
import "./role-management.css";
import "./role-authority.css";
import "./role-authority-page.css";
import "./role-authority-columns.css";

type Definition = { id: string; label: string; group: string };
type Authorities = Record<string, string[]>;
type Profile = { id: string; role: string; custom?: boolean; menuIds: string[]; authorities?: Authorities; updatedAt: string };
type Editor = { id?: string; role: string; menuIds: string[]; authorities: Authorities };
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const roleLabel = (role: string) => role.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const actionLabels: Record<string, string> = { new: "New", view: "View", edit: "Edit", delete: "Delete", publish: "Publish", unpublish: "Unpublish", reset_password: "Reset Password", lock_unlock: "Lock / Unlock", suspend: "Suspend", copy_link: "Copy Link" };

export default function RoleManagement() {
  const nav = useNavigate();
  const [routeParams] = useSearchParams();
  const roleParam = routeParams.get("role") || "";
  const creatingNew = roleParam === "new";
  const [roles, setRoles] = useState<string[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditingState] = useState<Editor | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${session()?.token}` };
  const setEditing = (value: Editor | null | ((current: Editor | null) => Editor | null)) => {
    setEditingState(value);
    if (value === null && roleParam) nav("/newsroom/roles", { replace: true });
  };
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const load = async () => {
    try {
      const data = await api("/api/role-menus/admin");
      setRoles(data.roles); setDefinitions(data.definitions); setActions(data.actions); setProfiles(data.profiles);
    } catch (error: any) { setNotice(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const filteredRoles = useMemo(() => roles.filter((role) => roleLabel(role).toLowerCase().includes(query.toLowerCase())), [roles, query]);
  const allAuthorities = () => Object.fromEntries(definitions.map((item) => [item.id, [...actions]]));
  const createRole = () => nav("/newsroom/roles?role=new");
  const prepareRole = (role: string) => {
    const profile = profiles.find((item) => item.role === role);
    const saved = profile?.authorities && Object.keys(profile.authorities).length ? profile.authorities : allAuthorities();
    setEditing({ id: profile?.id, role, menuIds: profile?.menuIds || definitions.map((item) => item.id), authorities: saved });
  };
  const openRole = (role: string) => nav(`/newsroom/roles?role=${encodeURIComponent(role)}`);
  useEffect(() => {
    if (!roleParam || !definitions.length || !actions.length) return;
    if (creatingNew) {
      setEditingState({ role: "", menuIds: definitions.map((item) => item.id), authorities: allAuthorities() });
      return;
    }
    if (!roles.includes(roleParam)) { nav("/newsroom/roles", { replace: true }); return; }
    if (editing?.role !== roleParam) prepareRole(roleParam);
  }, [roleParam, definitions, actions, profiles, roles]);
  const toggleVisible = (id: string) => setEditing((current) => current ? ({ ...current, menuIds: current.menuIds.includes(id) ? current.menuIds.filter((item) => item !== id) : [...current.menuIds, id] }) : current);
  const toggleAuthority = (menu: string, action: string) => setEditing((current) => {
    if (!current) return current;
    const selected = current.authorities[menu] || [];
    return { ...current, authorities: { ...current.authorities, [menu]: selected.includes(action) ? selected.filter((item) => item !== action) : [...selected, action] } };
  });
  const columnIsFull = (column: string) => editing ? column === "visible" ? definitions.every((menu) => editing.menuIds.includes(menu.id)) : definitions.every((menu) => (editing.authorities[menu.id] || []).includes(column)) : false;
  const toggleColumn = (column: string) => setEditing((current) => {
    if (!current) return current;
    if (column === "visible") return { ...current, menuIds: definitions.every((menu) => current.menuIds.includes(menu.id)) ? [] : definitions.map((menu) => menu.id) };
    const clear = definitions.every((menu) => (current.authorities[menu.id] || []).includes(column));
    return { ...current, authorities: Object.fromEntries(definitions.map((menu) => {
      const selected = current.authorities[menu.id] || [];
      return [menu.id, clear ? selected.filter((action) => action !== column) : [...new Set([...selected, column])]];
    })) };
  });
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3500); };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!editing) return; setSaving(true);
    try {
      if (!editing.role.trim()) throw new Error("Enter a role name");
      const payload = { role: editing.role, menuIds: editing.menuIds, authorities: editing.authorities };
      const profile = await api(editing.id ? `/api/role-menus/admin/${editing.id}` : "/api/role-menus/admin", { method: editing.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setRoles((current) => [...new Set([...current, profile.role])]);
      setProfiles((current) => [...current.filter((item) => item.id !== profile.id && item.role !== profile.role), profile]);
      setEditing(null);
    } catch (error: any) { flash(error.message); }
    finally { setSaving(false); }
  };
  const reset = async (profile: Profile) => {
    if (!confirm(profile.custom ? `Delete ${roleLabel(profile.role)}?` : `Reset ${roleLabel(profile.role)} to the default authorities?`)) return;
    try { await api(`/api/role-menus/admin/${profile.id}`, { method: "DELETE" }); setProfiles((current) => current.filter((item) => item.id !== profile.id)); if (profile.custom) setRoles((current) => current.filter((role) => role !== profile.role)); flash(profile.custom ? `${roleLabel(profile.role)} deleted` : `${roleLabel(profile.role)} reset to default`); }
    catch (error: any) { flash(error.message); }
  };
  const selectAll = () => setEditing((current) => current ? ({ ...current, menuIds: definitions.map((item) => item.id), authorities: allAuthorities() }) : current);
  const clearAll = () => setEditing((current) => current ? ({ ...current, menuIds: [], authorities: Object.fromEntries(definitions.map((item) => [item.id, []])) }) : current);

  const roleList = <section className="content rolePage">
    <div className="top"><div><small>SETTINGS / ROLES</small><h1>Roles &amp; menu access</h1><p>Control menu visibility and action authority for every system role.</p></div><button className="new" onClick={createRole}><Plus/>Add role access</button></div>
    {notice&&<div className="toast">{notice}<button onClick={() => setNotice("")}><X/></button></div>}
    <div className="roleSummary"><span><ShieldCheck/></span><div><b>{roles.length}</b><small>System roles</small></div><div><b>{profiles.length}</b><small>Customized authorities</small></div></div>
    <div className="panel rolePanel"><div className="roleTools"><label><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles" aria-label="Search roles"/></label><span>{filteredRoles.length} roles</span></div><div className="roleGrid">{loading?<div className="emptyState">Loading roles…</div>:filteredRoles.map((role) => { const profile = profiles.find((item) => item.role === role); return <article key={role}><div className="roleIcon"><ShieldCheck/></div><div><h2>{roleLabel(role)}</h2><p>{profile ? `${profile.menuIds.length} visible menus with custom authorities` : "Uses the default menu and authorities"}</p><span className={profile ? "custom" : "default"}>{profile ? "Customized" : "Default"}</span></div><div className="roleActions"><button aria-label={`Edit ${roleLabel(role)}`} title="Edit authorities" onClick={() => openRole(role)}><Pencil/></button>{profile&&<button className="danger" aria-label={`Reset ${roleLabel(role)}`} title="Reset to default" onClick={() => reset(profile)}><Trash2/></button>}</div></article>})}</div></div>
  </section>;
  const columnHeader = (column: string, label: string) => <th key={column}><span>{label}</span><button type="button" onClick={() => toggleColumn(column)}>{columnIsFull(column) ? "Clear all" : "Select all"}</button></th>;
  const editorPage = editing && <div className="modalBackdrop roleAuthorityBackdrop"><form className="userModal roleModal roleAuthorityModal" onSubmit={save}><div className="modalHead"><div><small>{creatingNew ? "ADD ROLE ACCESS" : "EDIT ROLE AUTHORITIES"}</small><h2>{creatingNew ? "Create a new role" : roleLabel(editing.role)}</h2></div><button type="button" aria-label="Close" onClick={() => setEditing(null)}><X/></button></div>{creatingNew&&<label>Role name<input autoFocus value={editing.role} onChange={(event) => setEditing((current) => current ? ({ ...current, role: event.target.value }) : current)} placeholder="e.g. Registration Coordinator" maxLength={50}/></label>}<div className="roleSelectActions"><button type="button" onClick={selectAll}>Select everything</button><button type="button" onClick={clearAll}>Clear everything</button><span>{editing.menuIds.length} visible menus</span></div><div className="roleAuthorityTableWrap"><table className="roleAuthorityTable"><thead><tr><th>Menu / Submenu</th>{columnHeader("visible", "Visible")}{actions.map((action) => columnHeader(action, actionLabels[action]))}</tr></thead><tbody>{definitions.map((menu, index) => <Fragment key={menu.id}><tr className={index === 0 || definitions[index - 1].group !== menu.group ? "groupStart" : ""}><th><small>{menu.group}</small>{menu.label}</th><td><label><input type="checkbox" checked={editing.menuIds.includes(menu.id)} onChange={() => toggleVisible(menu.id)}/><span><Check/></span></label></td>{actions.map((action) => <td key={action}><label><input type="checkbox" checked={(editing.authorities[menu.id] || []).includes(action)} onChange={() => toggleAuthority(menu.id, action)}/><span><Check/></span></label></td>)}</tr></Fragment>)}</tbody></table></div><div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="new" type="submit" disabled={saving}>{saving ? "Saving…" : creatingNew ? "Create role" : "Save authorities"}</button></div></form></div>;
  return <div className="dash roleManagement"><aside><Link to="/" className="brand light"><span>LN</span><div>LOCAL NEWS<small>NEWSROOM OS</small></div></Link><div className="workspace"><small>WORKSPACE</small><b>{session()?.user?.name}</b></div><button onClick={() => nav("/newsroom/stories")}><LayoutDashboard/>Overview</button><button onClick={() => nav("/newsroom/stories")}><FileText/>Stories</button><button onClick={() => nav("/newsroom/users")}><Users/>People</button><button disabled><BarChart3/>Analytics</button><button onClick={() => nav("/newsroom/settings")}><Settings/>Settings</button></aside>{roleList}{editorPage}</div>;
}
