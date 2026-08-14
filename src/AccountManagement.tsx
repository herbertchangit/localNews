import { useEffect, useMemo, useRef, useState } from "react";
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
  Download,
  Upload,
  CalendarDays,
  Share2,
  RotateCcw,
} from "lucide-react";
import { csvBoolean, parseCsv, toCsv } from "./userCsv";
import { pageCount, paginate } from "./pagination";
import { useAuthorities } from "./menuAccess";
import { whatsappEventInvitationUrl, whatsappPhone } from "./whatsappInvite";
import { nextHierarchyAssignment, type HierarchyLevel } from "./accountHierarchy";
import "./account-roles.css";
type Cat = { id: string; name: string };
type Group = { id: string; name: string };
type Mutual = Group & { harmonyId: string; cooperations: Group[] };
type Harmony = Group & { mutualLoves: Mutual[] };
type AreaOption = {
  id: string;
  name: string;
  mutualLove: Group & { harmony: Group };
};
type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  stayArea: string | null;
  labels: string[];
  organizationLevel: string | null;
  role: string;
  roles: string[];
  customRoles: string[];
  lastLoginAt: string | null;
  locked: boolean;
  suspended: boolean;
  permissions: string[];
  department: Group | null;
  harmonyGroup: Group | null;
  mutualLoveGroup: Group | null;
  cooperationUnit: Group | null;
  assignedCategories: Cat[];
  registeredEvents: Array<{ formId: string; eventName: string; eventDateId: string; eventDate: string }>;
  _count: { articles: number };
};
type AccountEvents = {
  forms: Array<{ id: string; eventName: string; slug: string; eventDates: Array<{ id: string; eventDate: string }> }>;
  appointments: Array<{ formId: string; eventName: string; eventDateId: string; eventDate: string; totalPersons: number; meal: boolean }>;
  invitations: Array<{ formId: string; sharePath: string; createdAt: string; invitedBy: { id: string; name: string } }>;
};
const blank = {
  name: "",
  email: "",
  phone: "",
  stayArea: "",
  labels: [] as string[],
  labelsText: "",
  organizationLevel: "",
  password: "Demo123!",
  role: "VOLUNTEER",
  roles: ["VOLUNTEER"] as string[],
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
  const allowed = useAuthorities("people");
  const nav = useNavigate(),
    activeSession = session(),
    token = activeSession?.token,
    currentUserId = activeSession?.user?.id;
  const importInput = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<User[]>([]),
    [departments, setDepartments] = useState<Group[]>([]),
    [categories, setCategories] = useState<Cat[]>([]),
    [structure, setStructure] = useState<Harmony[]>([]),
    [areas, setAreas] = useState<AreaOption[]>([]),
    [availableRoles, setAvailableRoles] = useState<string[]>([]),
    [edit, setEdit] = useState<any | null>(null),
    [accountEvents, setAccountEvents] = useState<AccountEvents | null>(null),
    [invitingFormId, setInvitingFormId] = useState(""),
    [inviting, setInviting] = useState(false),
    [revertingFormId, setRevertingFormId] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [roleFilter, setRoleFilter] = useState(""),
    [harmonyFilter, setHarmonyFilter] = useState(""),
    [mutualLoveFilter, setMutualLoveFilter] = useState(""),
    [cooperationFilter, setCooperationFilter] = useState(""),
    [reset, setReset] = useState<User | null>(null),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [hierarchySavingId, setHierarchySavingId] = useState(""),
    [page, setPage] = useState(1);
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
      const [u, options] = await Promise.all([
        api("/api/admin/accounts"),
        api("/api/admin/accounts/options"),
      ]);
      setUsers(u);
      setDepartments(options.departments);
      setCategories(options.categories);
      setStructure(options.structure);
      setAreas(options.areas);
      setAvailableRoles(options.roles);
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
  const roleLabel = (role: string) =>
    role === "ADMIN_MEDICAL"
      ? "Admin Medical"
      : role
          .replaceAll("_", " ")
          .toLowerCase()
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const mutualLoveOptions = useMemo(
    () =>
      harmonyFilter
        ? structure.find((harmony) => harmony.id === harmonyFilter)
            ?.mutualLoves || []
        : structure.flatMap((harmony) => harmony.mutualLoves),
    [structure, harmonyFilter],
  );
  const cooperationOptions = useMemo(
    () =>
      mutualLoveFilter
        ? mutualLoveOptions.find(
            (mutualLove) => mutualLove.id === mutualLoveFilter,
          )?.cooperations || []
        : mutualLoveOptions.flatMap((mutualLove) => mutualLove.cooperations),
    [mutualLoveOptions, mutualLoveFilter],
  );
  const visible = useMemo(
    () =>
      users.filter(
        (u) =>
          (!roleFilter || [...new Set([...(u.roles || []), u.role, ...(u.customRoles || [])])].includes(roleFilter)) &&
          (!harmonyFilter || u.harmonyGroup?.id === harmonyFilter) &&
          (!mutualLoveFilter || u.mutualLoveGroup?.id === mutualLoveFilter) &&
          (!cooperationFilter || u.cooperationUnit?.id === cooperationFilter) &&
          `${u.name} ${u.email} ${u.phone || ""} ${u.stayArea || ""} ${(u.labels || []).join(" ")} ${(u.registeredEvents || []).map((event) => event.eventName).join(" ")} ${u.harmonyGroup?.name || ""} ${u.mutualLoveGroup?.name || ""} ${u.cooperationUnit?.name || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [
      users,
      query,
      roleFilter,
      harmonyFilter,
      mutualLoveFilter,
      cooperationFilter,
    ],
  );
  const totalPages = pageCount(visible.length),
    pageUsers = useMemo(() => paginate(visible, page), [visible, page]),
    selectablePageUsers = pageUsers.filter((user) => user.id !== currentUserId),
    pageSelected =
      selectablePageUsers.length > 0 &&
      selectablePageUsers.every((user) => selected.has(user.id));
  useEffect(
    () => setPage(1),
    [query, roleFilter, harmonyFilter, mutualLoveFilter, cooperationFilter],
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const exportCsv = useMemo(
    () =>
      toCsv(
        [
          "name",
          "email",
          "role",
          "contact",
          "area",
          "labels",
          "organization",
          "harmony",
          "mutualLove",
          "cooperation",
          "level",
          "locked",
          "suspended",
          "password",
        ],
        users.map((user) => [
          user.name,
          user.email,
          user.role,
          user.phone,
          user.stayArea,
          (user.labels || []).join("|"),
          user.department?.name,
          user.harmonyGroup?.name,
          user.mutualLoveGroup?.name,
          user.cooperationUnit?.name,
          user.organizationLevel,
          user.locked,
          user.suspended,
          "",
        ]),
      ),
    [users],
  );
  const open = (u?: User) => {
    setAccountEvents(null);
    setInvitingFormId("");
    setEdit(
      u
        ? {
          ...u,
            roles: [...new Set([...(u.roles || []), u.role, ...(u.customRoles || [])])],
            phone: u.phone || "",
            stayArea: u.stayArea || "",
            organizationLevel: u.organizationLevel || "",
            password: "",
            departmentId: u.department?.id || "",
            harmonyGroupId: u.harmonyGroup?.id || "",
            mutualLoveGroupId: u.mutualLoveGroup?.id || "",
            cooperationUnitId: u.cooperationUnit?.id || "",
            categoryIds: u.assignedCategories.map((c) => c.id),
            labels: u.labels || [],
            labelsText: (u.labels || []).join(", "),
          }
        : { ...blank },
    );
    if (u)
      api(`/api/admin/accounts/${u.id}/events`)
        .then((events) => {
          setAccountEvents(events);
          const registered = new Set(events.appointments.map((appointment: any) => appointment.formId));
          const invited = new Set(events.invitations.map((invitation: any) => invitation.formId));
          setInvitingFormId(events.forms.find((form: any) => !registered.has(form.id) && !invited.has(form.id))?.id || "");
        })
        .catch((error) => flash(error.message));
  };
  const inviteToEvent = async () => {
    if (!edit?.id || !invitingFormId) return;
    if (!whatsappPhone(edit.phone || "")) {
      flash("Add a valid contact number before sending a WhatsApp invitation");
      return;
    }
    setInviting(true);
    let invitation: any = null;
    const whatsappWindow = window.open("about:blank", "_blank");
    try {
      invitation = await api(`/api/admin/accounts/${edit.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ formId: invitingFormId }),
      });
      const shareUrl = `${window.location.origin}${invitation.sharePath}`;
      const whatsappUrl = whatsappEventInvitationUrl({
        phone: edit.phone,
        recipientName: edit.name,
        inviterName: activeSession?.user?.name || "Local News",
        eventName: invitation.eventName,
        shareUrl,
      });
      if (whatsappWindow) {
        whatsappWindow.opener = null;
        whatsappWindow.location.replace(whatsappUrl);
      } else window.location.assign(whatsappUrl);
      const events = await api(`/api/admin/accounts/${edit.id}/events`);
      setAccountEvents(events);
      const registered = new Set(events.appointments.map((appointment: any) => appointment.formId));
      const invited = new Set(events.invitations.map((item: any) => item.formId));
      setInvitingFormId(events.forms.find((form: any) => !registered.has(form.id) && !invited.has(form.id))?.id || "");
    } catch (error: any) {
      whatsappWindow?.close();
      if (invitation)
        await api(`/api/admin/accounts/${edit.id}/invitations/cancel`, {
          method: "POST",
          body: JSON.stringify({ formId: invitation.formId }),
        }).catch(() => null);
      flash(error?.name === "AbortError" ? "Invitation sharing cancelled" : error.message);
    } finally {
      setInviting(false);
    }
  };
  const revertInvitation = async (formId: string, eventName: string) => {
    if (!edit?.id || revertingFormId) return;
    if (!window.confirm(`Revert the invitation to ${eventName}?`)) return;
    setRevertingFormId(formId);
    try {
      await api(`/api/admin/accounts/${edit.id}/invitations/cancel`, {
        method: "POST",
        body: JSON.stringify({ formId }),
      });
      const events = await api(`/api/admin/accounts/${edit.id}/events`);
      setAccountEvents(events);
      setInvitingFormId(formId);
      flash("Invitation reverted. The event can be invited again.");
    } catch (error: any) {
      flash(error.message || "Could not revert invitation");
    } finally {
      setRevertingFormId("");
    }
  };
  const mutuals = edit
    ? structure.find((h) => h.id === edit.harmonyGroupId)?.mutualLoves || []
    : [];
  const units = edit
    ? mutuals.find((m) => m.id === edit.mutualLoveGroupId)?.cooperations || []
    : [];
  const registeredFormIds = new Set(accountEvents?.appointments.map((appointment) => appointment.formId) || []);
  const invitationByForm = new Map(accountEvents?.invitations.map((invitation) => [invitation.formId, invitation]) || []);
  const availableInvitationForms = accountEvents?.forms.filter((form) => !registeredFormIds.has(form.id) && !invitationByForm.has(form.id)) || [];
  const save = async (e: any) => {
    e.preventDefault();
    try {
      if (!edit.roles?.length) throw new Error("Select at least one role");
      const editing = !!edit.id,
        body = {
          ...edit,
          phone: edit.phone?.trim() || null,
          stayArea: edit.stayArea?.trim() || null,
          labels: [
            ...new Set(
              edit.labelsText
                .split(",")
                .map((value: string) => value.trim())
                .filter(Boolean),
            ),
          ],
          departmentId: edit.departmentId || null,
          harmonyGroupId: edit.harmonyGroupId || null,
          mutualLoveGroupId: edit.mutualLoveGroupId || null,
          cooperationUnitId: edit.cooperationUnitId || null,
          organizationLevel: edit.organizationLevel || null,
        };
      for (const k of [
        "id",
        "department",
        "harmonyGroup",
        "mutualLoveGroup",
        "cooperationUnit",
        "assignedCategories",
        "labelsText",
        "customRoles",
        "_count",
      ])
        delete body[k];
      if (editing) {
        delete body.email;
        delete body.password;
      }
      const saved = await api(
        `/api/admin/accounts${editing ? "/" + edit.id : ""}`,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
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
  const importUsers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("CSV files must be 2 MB or smaller");
      const rows = parseCsv(await file.text());
      if (!rows.length)
        throw new Error("The CSV file does not contain any users");
      if (!("name" in rows[0]) || !("email" in rows[0]))
        throw new Error("CSV requires name and email columns");
      const usersToImport = rows.map((row) => ({
        name: row.name,
        email: row.email,
        role: (row.role || "DADE").toUpperCase(),
        contact: row.contact || row.phone || "",
        area: row.area || row.stayarea || "",
        labels: row.labels || "",
        organization: row.organization || "",
        harmony: row.harmony || "",
        mutualLove: row.mutuallove || row.mutual_love || "",
        cooperation: row.cooperation || "",
        organizationLevel: row.level
          ? row.level.trim().toUpperCase().replaceAll(" ", "_")
          : null,
        locked: csvBoolean(row.locked || ""),
        suspended: csvBoolean(row.suspended || ""),
        ...(row.password ? { password: row.password } : {}),
      }));
      const result = await api("/api/admin/accounts/import", {
        method: "POST",
        body: JSON.stringify({ users: usersToImport }),
      });
      await load();
      flash(
        `Import complete: ${result.created} created, ${result.updated} updated${result.errors.length ? `, ${result.errors.length} skipped — ${result.errors.slice(0, 2).join("; ")}` : ""}`,
      );
    } catch (error: any) {
      flash(error.message || "Could not import users");
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
  const updateHierarchy = async (
    user: User,
    level: HierarchyLevel,
    value: string,
  ) => {
    if (hierarchySavingId) return;
    const hierarchy = nextHierarchyAssignment({
      harmonyGroupId: user.harmonyGroup?.id || null,
      mutualLoveGroupId: user.mutualLoveGroup?.id || null,
      cooperationUnitId: user.cooperationUnit?.id || null,
    }, level, value);
    setHierarchySavingId(user.id);
    try {
      const saved = await api(`/api/admin/accounts/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(hierarchy),
      });
      setUsers((current) =>
        current.map((item) =>
          item.id === saved.id
            ? { ...item, ...saved, registeredEvents: item.registeredEvents }
            : item,
        ),
      );
      flash("Organization assignment updated");
    } catch (error: any) {
      flash(error.message || "Could not update organization assignment");
    } finally {
      setHierarchySavingId("");
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
  const bulkRemove = async () => {
    const targets = users.filter(
      (user) => selected.has(user.id) && user.id !== currentUserId,
    );
    if (!targets.length || !confirm(`Delete ${targets.length} selected users?`))
      return;
    let deleted = 0;
    const failures: string[] = [];
    for (const user of targets) {
      try {
        await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
        deleted++;
      } catch (error: any) {
        failures.push(`${user.name}: ${error.message}`);
      }
    }
    setSelected(new Set());
    await load();
    flash(
      `${deleted} users deleted${failures.length ? `, ${failures.length} not deleted — ${failures.slice(0, 2).join("; ")}` : ""}`,
    );
  };
  const togglePage = () =>
    setSelected((current) => {
      const next = new Set(current);
      selectablePageUsers.forEach((user) =>
        pageSelected ? next.delete(user.id) : next.add(user.id),
      );
      return next;
    });
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
  const canInlineEditHierarchy =
    allowed("edit") &&
    [activeSession?.user?.role, ...(activeSession?.user?.roles || [])].includes(
      "ADMIN",
    );
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
          <div className="accountTopActions">
            <input
              ref={importInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={importUsers}
            />
            {allowed("new") && (
              <button
                className="accountTransferAction"
                type="button"
                onClick={() => importInput.current?.click()}
              >
                <Upload />
                Import CSV
              </button>
            )}
            <a
              className="accountTransferAction"
              href={`data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(exportCsv)}`}
              download={`local-news-users-${new Date().toISOString().slice(0, 10)}.csv`}
            >
              <Download />
              Export CSV
            </a>
            {allowed("new") && (
              <button className="new" onClick={() => open()}>
                <Plus />
                Create user
              </button>
            )}
          </div>
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
            {!!selected.size && allowed("delete") && (
              <button className="bulkDelete" type="button" onClick={bulkRemove}>
                <Trash2 />
                Delete selected ({selected.size})
              </button>
            )}
            <span>{visible.length} people</span>
          </div>
          <div className="accountFilters" aria-label="Filter users">
            <label>
              Role
              <select
                data-role-options-ignore="true"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="">All roles</option>
                {availableRoles.map((role) => (
                  <option value={role} key={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Harmony
              <select
                value={harmonyFilter}
                onChange={(event) => {
                  setHarmonyFilter(event.target.value);
                  setMutualLoveFilter("");
                  setCooperationFilter("");
                }}
              >
                <option value="">All Harmony</option>
                {structure.map((harmony) => (
                  <option value={harmony.id} key={harmony.id}>
                    {harmony.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              MutualLove
              <select
                value={mutualLoveFilter}
                onChange={(event) => {
                  setMutualLoveFilter(event.target.value);
                  setCooperationFilter("");
                }}
              >
                <option value="">All MutualLove</option>
                {mutualLoveOptions.map((mutualLove) => (
                  <option value={mutualLove.id} key={mutualLove.id}>
                    {mutualLove.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cooperation
              <select
                value={cooperationFilter}
                onChange={(event) => setCooperationFilter(event.target.value)}
              >
                <option value="">All Cooperation</option>
                {cooperationOptions.map((cooperation) => (
                  <option value={cooperation.id} key={cooperation.id}>
                    {cooperation.name}
                  </option>
                ))}
              </select>
            </label>
            {(roleFilter ||
              harmonyFilter ||
              mutualLoveFilter ||
              cooperationFilter) && (
              <button
                type="button"
                onClick={() => {
                  setRoleFilter("");
                  setHarmonyFilter("");
                  setMutualLoveFilter("");
                  setCooperationFilter("");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="accountRow accountHeader">
            <span className="accountSelectHeader">
              <input
                type="checkbox"
                aria-label="Select all users on this page"
                checked={pageSelected}
                onChange={togglePage}
                disabled={!selectablePageUsers.length || !allowed("delete")}
              />
              Person
            </span>
            <span>Organization assignment</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {pageUsers.map((u) => {
            const rowMutualLoves =
                structure.find((harmony) => harmony.id === u.harmonyGroup?.id)
                  ?.mutualLoves || [],
              rowCooperations =
                rowMutualLoves.find(
                  (mutualLove) => mutualLove.id === u.mutualLoveGroup?.id,
                )?.cooperations || [],
              hierarchySaving = hierarchySavingId === u.id;
            return <div className="accountRow" key={u.id}>
              <div className="person accountSelectable">
                <input
                  type="checkbox"
                  aria-label={`Select ${u.name}`}
                  checked={selected.has(u.id)}
                  disabled={u.id === currentUserId || !allowed("delete")}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      event.target.checked ? next.add(u.id) : next.delete(u.id);
                      return next;
                    })
                  }
                />
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
                  {(u.phone || u.stayArea) && (
                    <small>
                      {[u.phone, u.stayArea].filter(Boolean).join(" · ")}
                    </small>
                  )}
                  <small className="accountLastLogin">
                    <b>Last login</b>
                    <time>
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "Never"}
                    </time>
                  </small>
                  {!!u.registeredEvents?.length && (
                    <span className="accountRegisteredEvents">
                      {u.registeredEvents.map((event) => (
                        <small key={`${event.formId}-${event.eventDateId}`}>
                          <CalendarDays />
                          <b>{event.eventName}</b>
                          <time>{new Date(event.eventDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>
                        </small>
                      ))}
                    </span>
                  )}
                  {!!u.labels?.length && (
                    <span className="accountLabels">
                      {u.labels.map((label) => (
                        <i key={label}>{label}</i>
                      ))}
                    </span>
                  )}
                </span>
              </div>
              <div className="accountHierarchy">
                <small className="organizationLine">
                  <i>{[...new Set([...(u.roles || []), u.role, ...(u.customRoles || [])])].map(roleLabel).join(", ")}</i>
                  {u.department?.name && (
                    <>
                      {" "}
                      : <em>{u.department.name}</em>
                    </>
                  )}
                </small>
                {canInlineEditHierarchy ? <>
                  <select aria-label={`Harmony for ${u.name}`} value={u.harmonyGroup?.id || ""} disabled={hierarchySaving} onChange={(event) => updateHierarchy(u, "harmony", event.target.value)}>
                    <option value="">—</option>
                    {structure.map((harmony) => <option value={harmony.id} key={harmony.id}>{harmony.name}</option>)}
                  </select>
                  <b>›</b>
                  <select aria-label={`MutualLove for ${u.name}`} value={u.mutualLoveGroup?.id || ""} disabled={hierarchySaving || !u.harmonyGroup} onChange={(event) => updateHierarchy(u, "mutualLove", event.target.value)}>
                    <option value="">—</option>
                    {rowMutualLoves.map((mutualLove) => <option value={mutualLove.id} key={mutualLove.id}>{mutualLove.name}</option>)}
                  </select>
                  <b>›</b>
                  <select aria-label={`Cooperation for ${u.name}`} value={u.cooperationUnit?.id || ""} disabled={hierarchySaving || !u.mutualLoveGroup} onChange={(event) => updateHierarchy(u, "cooperation", event.target.value)}>
                    <option value="">—</option>
                    {rowCooperations.map((cooperation) => <option value={cooperation.id} key={cooperation.id}>{cooperation.name}</option>)}
                  </select>
                </> : <>
                  <span>{u.harmonyGroup?.name || "—"}</span>
                  <b>›</b>
                  <span>{u.mutualLoveGroup?.name || "—"}</span>
                  <b>›</b>
                  <span>{u.cooperationUnit?.name || "—"}</span>
                </>}
              </div>
              <span className={"rolePill " + u.role.toLowerCase()}>
                {[...new Set([...(u.roles || []), u.role, ...(u.customRoles || [])])].map(roleLabel).join(", ")}
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
                {allowed("edit") && (
                  <button title="Edit user" onClick={() => open(u)}>
                    <Pencil />
                  </button>
                )}
                {allowed("reset_password") && (
                  <button title="Reset password" onClick={() => setReset(u)}>
                    <KeyRound />
                  </button>
                )}
                {allowed("lock_unlock") && (
                  <button
                    title={u.locked ? "Unlock" : "Lock"}
                    onClick={() => status(u, { locked: !u.locked })}
                  >
                    {u.locked ? <Unlock /> : <Lock />}
                  </button>
                )}
                {allowed("suspend") && (
                  <button
                    title={u.suspended ? "Restore" : "Suspend"}
                    onClick={() => status(u, { suspended: !u.suspended })}
                  >
                    <PauseCircle />
                  </button>
                )}
                {allowed("delete") && (
                  <button
                    className="danger"
                    disabled={u.id === currentUserId}
                    onClick={() => remove(u)}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            </div>;
          })}
          {!pageUsers.length && (
            <div className="emptyState">
              No users match the selected filters.
            </div>
          )}
          <div className="accountPagination">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next
            </button>
          </div>
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
                Contact
                <input
                  type="tel"
                  maxLength={40}
                  value={edit.phone || ""}
                  onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                  placeholder="Phone or contact number"
                />
              </label>
              <label>
                Area
                <select
                  value={edit.stayArea || ""}
                  onChange={(e) =>
                    setEdit({ ...edit, stayArea: e.target.value })
                  }
                >
                  <option value="">Select area</option>
                  {edit.stayArea &&
                    !areas.some((area) => area.name === edit.stayArea) && (
                      <option value={edit.stayArea}>
                        {edit.stayArea} (current)
                      </option>
                    )}
                  {areas.map((area) => (
                    <option value={area.name} key={area.id}>
                      {area.name} : {area.mutualLove.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Labels
              <input
                maxLength={400}
                value={edit.labelsText}
                onChange={(e) =>
                  setEdit({ ...edit, labelsText: e.target.value })
                }
                placeholder="Separate labels with commas"
              />
              <small className="fieldHint">
                Example: volunteer, translator, event team
              </small>
            </label>
            <fieldset className="accountRoleChoices" data-role-options-ignore="true">
              <legend>Roles</legend>
              <div>
                {availableRoles.map((role) => {
                  const checked = (edit.roles || []).includes(role);
                  return (
                    <label key={role}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setEdit((current: any) => ({
                            ...current,
                            roles: event.target.checked
                              ? [...new Set([...(current.roles || []), role])]
                              : (current.roles || []).filter((item: string) => item !== role),
                          }))
                        }
                      />
                      <span>{roleLabel(role)}</span>
                    </label>
                  );
                })}
              </div>
              <small>Select one or more roles. Access from the selected roles is combined.</small>
            </fieldset>
            <div className="formPair">
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
                <label>
                  Level
                  <select
                    value={edit.organizationLevel || ""}
                    onChange={(e) =>
                      setEdit({ ...edit, organizationLevel: e.target.value })
                    }
                  >
                    <option value="">Unassigned</option>
                    <option value="HARMONY_LEADER">Harmony Leader</option>
                    <option value="MUTUAL_LOVE_LEADER">
                      MutualLove Leader
                    </option>
                    <option value="COOPERATION_LEADER">
                      Cooperation Leader
                    </option>
                  </select>
                </label>
              </div>
            </fieldset>
            {edit.id && <fieldset className="hierarchyFields accountEventAccess">
              <legend>
                <CalendarDays />
                Event appointments and invitations
              </legend>
              {!accountEvents ? <p>Loading event records…</p> : <>
                <div className="accountAppointmentList">
                  <strong>User appointments</strong>
                  {accountEvents.appointments.length ? accountEvents.appointments.map((appointment) => (
                    <span key={`${appointment.formId}-${appointment.eventDateId}`}>
                      <b>{appointment.eventName}</b>
                      <time>{new Date(appointment.eventDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time>
                    </span>
                  )) : <small>No event appointments found for this contact number.</small>}
                </div>
                <div className="accountInvitationList">
                  <strong>Event invitations</strong>
                  {accountEvents.forms.map((form) => {
                    const invitation = invitationByForm.get(form.id);
                    return invitation ? <span key={form.id}>
                      <span><b>{form.eventName}</b>
                      <small>Invited by {invitation.invitedBy.name} · {new Date(invitation.createdAt).toLocaleDateString()}</small></span>
                      <button className="accountInvitationRevert" type="button" onClick={() => revertInvitation(form.id, form.eventName)} disabled={Boolean(revertingFormId)} title="Revert invitation">
                        <RotateCcw />{revertingFormId === form.id ? "Reverting…" : "Revert"}
                      </button>
                    </span> : registeredFormIds.has(form.id) ? <span key={form.id}>
                      <b>{form.eventName}</b><small>Already registered</small>
                    </span> : null;
                  })}
                  <div className="accountInviteAction">
                    <select value={invitingFormId} onChange={(event) => setInvitingFormId(event.target.value)} disabled={!availableInvitationForms.length}>
                      <option value="">{availableInvitationForms.length ? "Select an event" : "No events available to invite"}</option>
                      {availableInvitationForms.map((form) => <option value={form.id} key={form.id}>{form.eventName}</option>)}
                    </select>
                    <button type="button" onClick={inviteToEvent} disabled={!invitingFormId || inviting}>
                      <Share2 />{inviting ? "Opening WhatsApp…" : "Invite via WhatsApp"}
                    </button>
                  </div>
                </div>
              </>}
            </fieldset>}
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
