import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  Plus,
  Pencil,
  KeyRound,
  Lock,
  Unlock,
  PauseCircle,
  Trash2,
  X,
  Network,
} from "lucide-react";
type Cat = { id: string; name: string };
type Group = { id: string; name: string };
type Mutual = Group & { harmonyId: string; cooperations: Group[] };
type Harmony = Group & { mutualLoves: Mutual[] };
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  locked: boolean;
  suspended: boolean;
  permissions: string[];
  department: Group | null;
  harmonyGroup: Group | null;
  mutualLoveGroup: Group | null;
  cooperationUnit: Group | null;
  assignedCategories: Cat[];
  _count: { articles: number };
};
const blank = {
  name: "",
  email: "",
  password: "Demo123!",
  role: "VOLUNTEER",
  locked: false,
  suspended: false,
  permissions: [] as string[],
  departmentId: "",
  harmonyGroupId: "",
  mutualLoveGroupId: "",
  cooperationUnitId: "",
  categoryIds: [] as string[],
};
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
export default function AccountManagement() {
  const nav = useNavigate(),
    token = session()?.token;
  const [users, setUsers] = useState<User[]>([]),
    [departments, setDepartments] = useState<Group[]>([]),
    [categories, setCategories] = useState<Cat[]>([]),
    [structure, setStructure] = useState<Harmony[]>([]),
    [edit, setEdit] = useState<any | null>(null),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [reset, setReset] = useState<User | null>(null);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const api = async (url: string, opt: any = {}) => {
    const r = await fetch(url, { ...opt, headers });
    const x = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw new Error(x?.error || "Request failed");
    return x;
  };
  const load = async () => {
    try {
      const [u, o, s] = await Promise.all([
        api("/api/admin/accounts"),
        api("/api/admin/user-options"),
        api("/api/admin/org-structure"),
      ]);
      setUsers(u);
      setDepartments(o.departments);
      setCategories(o.categories);
      setStructure(s);
    } catch (e: any) {
      setNotice(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const flash = (x: string) => {
    setNotice(x);
    setTimeout(() => setNotice(""), 3000);
  };
  const visible = useMemo(
    () =>
      users.filter((u) =>
        `${u.name} ${u.email} ${u.harmonyGroup?.name || ""} ${u.mutualLoveGroup?.name || ""} ${u.cooperationUnit?.name || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [users, query],
  );
  const open = (u?: User) =>
    setEdit(
      u
        ? {
            ...u,
            password: "",
            departmentId: u.department?.id || "",
            harmonyGroupId: u.harmonyGroup?.id || "",
            mutualLoveGroupId: u.mutualLoveGroup?.id || "",
            cooperationUnitId: u.cooperationUnit?.id || "",
            categoryIds: u.assignedCategories.map((c) => c.id),
          }
        : { ...blank },
    );
  const mutuals = edit
    ? structure.find((h) => h.id === edit.harmonyGroupId)?.mutualLoves || []
    : [];
  const units = edit
    ? mutuals.find((m) => m.id === edit.mutualLoveGroupId)?.cooperations || []
    : [];
  const save = async (e: any) => {
    e.preventDefault();
    try {
      const editing = !!edit.id,
        body = {
          ...edit,
          departmentId: edit.departmentId || null,
          harmonyGroupId: edit.harmonyGroupId || null,
          mutualLoveGroupId: edit.mutualLoveGroupId || null,
          cooperationUnitId: edit.cooperationUnitId || null,
        };
      for (const k of [
        "id",
        "department",
        "harmonyGroup",
        "mutualLoveGroup",
        "cooperationUnit",
        "assignedCategories",
        "_count",
      ])
        delete body[k];
      if (editing) {
        delete body.email;
        delete body.password;
      }
      const saved = await api(`/api/admin/accounts${editing ? "/" + edit.id : ""}`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setUsers((current) =>
        editing
          ? current.map((user) => (user.id === saved.id ? saved : user))
          : [saved, ...current],
      );
      setEdit(null);
      flash("Account saved successfully");
      await load();
    } catch (e: any) {
      flash(e.message);
    }
  };
  const status = async (u: User, data: any) => {
    try {
      await api(`/api/admin/accounts/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      load();
    } catch (e: any) {
      flash(e.message);
    }
  };
  const remove = async (u: User) => {
    if (!confirm(`Delete ${u.name}?`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      flash(e.message);
    }
  };
  const resetPassword = async (e: any) => {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password");
    try {
      await api(`/api/admin/users/${reset!.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setReset(null);
      flash("Password reset successfully");
    } catch (e: any) {
      flash(e.message);
    }
  };
  return (
    <div className="dash">
      <aside>
        <Link to="/" className="brand light">
          <span>LN</span>
          <div>
            LOCAL NEWS<small>NEWSROOM OS</small>
          </div>
        </Link>
        <div className="workspace">
          <small>WORKSPACE</small>
          <b>Central News Desk</b>
        </div>
        <button onClick={() => nav("/newsroom")}>
          <LayoutDashboard />
          Overview
        </button>
        <button>
          <FileText />
          Stories<em>14</em>
        </button>
        <button className="active">
          <Users />
          People
        </button>
        <button>
          <BarChart3 />
          Analytics
        </button>
        <button>
          <Settings />
          Settings
        </button>
        <div className="profile">
          <div>HC</div>
          <span>
            <b>Harper Cole</b>
            <small>Administrator</small>
          </span>
        </div>
      </aside>
      <section className="content accountPage">
        <div className="top">
          <div>
            <small>ADMINISTRATION / PEOPLE</small>
            <h1>User management</h1>
            <p>Manage accounts and normalized organization assignments.</p>
          </div>
          <button className="new" onClick={() => open()}>
            <Plus />
            Create user
          </button>
        </div>
        {notice && (
          <div className="toast">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        <div className="panel accountPanel">
          <div className="userTools">
            <div className="userSearch">
              <Users />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people or organization assignment"
              />
            </div>
            <span>{visible.length} people</span>
          </div>
          <div className="accountRow accountHeader">
            <span>Person</span>
            <span>Organization assignment</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {visible.map((u) => (
            <div className="accountRow" key={u.id}>
              <div className="person">
                <span className="avatar">
                  {u.name
                    .split(" ")
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  <b>{u.name}</b>
                  <small>{u.email}</small>
                </span>
              </div>
              <div className="accountHierarchy">
                <span>{u.harmonyGroup?.name || "—"}</span>
                <b>›</b>
                <span>{u.mutualLoveGroup?.name || "—"}</span>
                <b>›</b>
                <span>{u.cooperationUnit?.name || "—"}</span>
              </div>
              <span className={"rolePill " + u.role.toLowerCase()}>
                {u.role}
              </span>
              <span
                className={
                  "statePill " +
                  (u.suspended ? "suspended" : u.locked ? "locked" : "active")
                }
              >
                {u.suspended ? "Suspended" : u.locked ? "Locked" : "Active"}
              </span>
              <div className="wideActions">
                <button title="Edit user" onClick={() => open(u)}>
                  <Pencil />
                </button>
                <button title="Reset password" onClick={() => setReset(u)}>
                  <KeyRound />
                </button>
                <button
                  title={u.locked ? "Unlock" : "Lock"}
                  onClick={() => status(u, { locked: !u.locked })}
                >
                  {u.locked ? <Unlock /> : <Lock />}
                </button>
                <button
                  title={u.suspended ? "Restore" : "Suspend"}
                  onClick={() => status(u, { suspended: !u.suspended })}
                >
                  <PauseCircle />
                </button>
                <button
                  className="danger"
                  disabled={u.email === "admin@local.news"}
                  onClick={() => remove(u)}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {edit && (
        <div className="modalBackdrop">
          <form className="userModal accountEditor" onSubmit={save}>
            <div className="modalHead">
              <div>
                <small>{edit.id ? "EDIT ACCOUNT" : "NEW ACCOUNT"}</small>
                <h2>{edit.id ? edit.name : "Create newsroom user"}</h2>
              </div>
              <button type="button" onClick={() => setEdit(null)}>
                <X />
              </button>
            </div>
            <div className="formPair">
              <label>
                Full name
                <input
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  required
                  disabled={!!edit.id}
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </label>
            </div>
            {!edit.id && (
              <label>
                Temporary password
                <input
                  required
                  minLength={8}
                  value={edit.password}
                  onChange={(e) =>
                    setEdit({ ...edit, password: e.target.value })
                  }
                />
              </label>
            )}
            <div className="formPair">
              <label>
                Role
                <select
                  value={edit.role}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                >
                  {["ADMIN", "EDITOR", "VOLUNTEER", "DADE"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Organization
                <select
                  value={edit.departmentId}
                  onChange={(e) =>
                    setEdit({ ...edit, departmentId: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="hierarchyFields">
              <legend>
                <Network />
                Organization hierarchy assignment
              </legend>
              <div>
                <label>
                  Harmony
                  <select
                    value={edit.harmonyGroupId}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        harmonyGroupId: e.target.value,
                        mutualLoveGroupId: "",
                        cooperationUnitId: "",
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {structure.map((h) => (
                      <option value={h.id} key={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  MutualLove
                  <select
                    disabled={!edit.harmonyGroupId}
                    value={edit.mutualLoveGroupId}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        mutualLoveGroupId: e.target.value,
                        cooperationUnitId: "",
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {mutuals.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cooperation
                  <select
                    disabled={!edit.mutualLoveGroupId}
                    value={edit.cooperationUnitId}
                    onChange={(e) =>
                      setEdit({ ...edit, cooperationUnitId: e.target.value })
                    }
                  >
                    <option value="">Unassigned</option>
                    {units.map((u) => (
                      <option value={u.id} key={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>
            <div className="accountChecks">
              <label>
                <input
                  type="checkbox"
                  checked={edit.locked}
                  onChange={(e) =>
                    setEdit({ ...edit, locked: e.target.checked })
                  }
                />
                Lock account
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={edit.suspended}
                  onChange={(e) =>
                    setEdit({ ...edit, suspended: e.target.checked })
                  }
                />
                Suspend user
              </label>
            </div>
            <div className="modalActions">
              <button type="button" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="new" type="submit">
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}
      {reset && (
        <div className="modalBackdrop">
          <form className="userModal resetModal" onSubmit={resetPassword}>
            <div className="modalHead">
              <div>
                <small>SECURITY</small>
                <h2>Reset password</h2>
              </div>
              <button type="button" onClick={() => setReset(null)}>
                <X />
              </button>
            </div>
            <label>
              New password
              <input
                name="password"
                required
                minLength={8}
                defaultValue="Demo123!"
              />
            </label>
            <div className="modalActions">
              <button type="button" onClick={() => setReset(null)}>
                Cancel
              </button>
              <button className="new">Reset password</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
