import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { useAuthorities } from "./menuAccess";
import "./grouping-selected-filter.css";

type GroupUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
};
type UserGroup = {
  id: string;
  name: string;
  description?: string | null;
  harmonyGroup?: { id: string; name: string } | null;
  users: GroupUser[];
};
type GroupEditor = {
  id?: string;
  name: string;
  description: string;
  userIds: string[];
};

const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");

export default function GroupingManagement() {
  const allowed = useAuthorities("settings_grouping");
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [users, setUsers] = useState<GroupUser[]>([]);
  const [query, setQuery] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [editing, setEditing] = useState<GroupEditor | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session()?.token || ""}`,
  };
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const load = async () => {
    setLoading(true);
    try {
      const [groupItems, userItems] = await Promise.all([
        api("/api/admin/groupings"),
        api("/api/admin/groupings/users"),
      ]);
      setGroups(groupItems);
      setUsers(userItems);
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((group) =>
      `${group.name} ${group.description || ""} ${group.users.map((user) => user.name).join(" ")}`
        .toLowerCase()
        .includes(needle),
    );
  }, [groups, query]);
  const filteredUsers = useMemo(() => {
    const needle = memberQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (showSelectedOnly && !editing?.userIds.includes(user.id)) return false;
      return !needle || `${user.name} ${user.email} ${user.phone || ""} ${user.role}`
        .toLowerCase()
        .includes(needle);
    });
  }, [users, memberQuery, showSelectedOnly, editing?.userIds]);
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const openNew = () => {
    setMemberQuery("");
    setShowSelectedOnly(false);
    setEditing({ name: "", description: "", userIds: [] });
  };
  const openEdit = (group: UserGroup) => {
    setMemberQuery("");
    setShowSelectedOnly(false);
    setEditing({
      id: group.id,
      name: group.name,
      description: group.description || "",
      userIds: group.users.map((user) => user.id),
    });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const group = await api(
        editing.id ? `/api/admin/groupings/${editing.id}` : "/api/admin/groupings",
        {
          method: editing.id ? "PATCH" : "POST",
          body: JSON.stringify({
            name: editing.name,
            description: editing.description || null,
            userIds: editing.userIds,
          }),
        },
      );
      setGroups((current) =>
        (editing.id
          ? current.map((item) => (item.id === group.id ? group : item))
          : [...current, group]
        ).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditing(null);
      flash(editing.id ? "Group updated" : "Group created");
    } catch (error: any) {
      flash(error.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (group: UserGroup) => {
    if (!confirm(`Delete ${group.name}?`)) return;
    try {
      await api(`/api/admin/groupings/${group.id}`, { method: "DELETE" });
      setGroups((current) => current.filter((item) => item.id !== group.id));
      flash("Group deleted");
    } catch (error: any) {
      flash(error.message);
    }
  };
  const toggleUser = (userId: string, checked: boolean) =>
    setEditing((current) =>
      current
        ? {
            ...current,
            userIds: checked
              ? [...new Set([...current.userIds, userId])]
              : current.userIds.filter((id) => id !== userId),
          }
        : current,
    );

  return (
    <div className="dash groupingManagement">
      <aside>
        <Link to="/" className="brand light"><span>LN</span><div>LOCAL NEWS<small>NEWSROOM OS</small></div></Link>
      </aside>
      <section className="content groupingPage">
        <div className="top">
          <div>
            <small>SETTINGS / GROUPING</small>
            <h1>Grouping</h1>
            <p>Create groups and add users as members.</p>
          </div>
          {allowed("new") && <button className="new" onClick={openNew}><Plus />Create group</button>}
        </div>
        {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}><X /></button></div>}
        <div className="groupingSummary">
          <div><Users /><span><b>{groups.length}</b><small>Groups</small></span></div>
          <div><Users /><span><b>{new Set(groups.flatMap((group) => group.users.map((user) => user.id))).size}</b><small>Grouped users</small></span></div>
        </div>
        <div className="panel groupingPanel">
          <div className="groupingTools">
            <label><Search /><input aria-label="Search groups" placeholder="Search groups or members" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <span>{filteredGroups.length} groups</span>
          </div>
          {loading ? <div className="emptyState">Loading groups…</div> : filteredGroups.length ? (
            <div className="groupingGrid">
              {filteredGroups.map((group) => (
                <article key={group.id}>
                  <header><div><h2>{group.name}</h2><p>{group.description || "No description"}</p><small>Harmony: {group.harmonyGroup?.name || "Unassigned"}</small></div><strong>{group.users.length}</strong></header>
                  <div className="groupingMembers">
                    {group.users.slice(0, 8).map((user) => <span key={user.id}>{user.name}</span>)}
                    {group.users.length > 8 && <span>+{group.users.length - 8} more</span>}
                    {!group.users.length && <small>No users added</small>}
                  </div>
                  <footer>
                    {allowed("edit") && <button aria-label={`Edit ${group.name}`} onClick={() => openEdit(group)}><Pencil />Edit</button>}
                    {allowed("delete") && <button className="danger" aria-label={`Delete ${group.name}`} onClick={() => remove(group)}><Trash2 />Delete</button>}
                  </footer>
                </article>
              ))}
            </div>
          ) : <div className="emptyState">No groups found.</div>}
        </div>
      </section>
      {editing && (
        <div className="modalBackdrop" onMouseDown={() => setEditing(null)}>
          <form className="userModal groupingModal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><small>{editing.id ? "EDIT GROUP" : "NEW GROUP"}</small><h2>{editing.id ? "Update group" : "Create group"}</h2></div><button type="button" aria-label="Close" onClick={() => setEditing(null)}><X /></button></div>
            <label>Group name<input autoFocus required minLength={2} maxLength={100} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></label>
            <label>Description<textarea rows={3} maxLength={500} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
            <fieldset>
              <legend>Users <span>{editing.userIds.length} selected</span></legend>
              <div className="groupingUserFilters">
                <label className="groupingUserSearch"><Search /><input aria-label="Search users to add" placeholder="Search name, email or mobile" value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} /></label>
                <label className="groupingSelectedFilter"><input type="checkbox" checked={showSelectedOnly} onChange={(event) => setShowSelectedOnly(event.target.checked)} />Show selected only</label>
              </div>
              <div className="groupingUserList">
                {filteredUsers.map((user) => (
                  <label key={user.id}>
                    <input type="checkbox" checked={editing.userIds.includes(user.id)} onChange={(event) => toggleUser(user.id, event.target.checked)} />
                    <span><b>{user.name}</b><small>{user.email}{user.phone ? ` · ${user.phone}` : ""}</small></span>
                    <em>{user.role.replaceAll("_", " ")}</em>
                  </label>
                ))}
                {!filteredUsers.length && <div className="emptyState">No users found.</div>}
              </div>
            </fieldset>
            <div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="new" disabled={saving}>{saving ? "Saving…" : editing.id ? "Save changes" : "Create group"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
