import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  ImagePlus,
  LayoutDashboard,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuthorities } from "./menuAccess";
import { registrationCsv, registrationCsvFilename } from "./registrationCsv";

type EventDate = { id: string; eventDate: string };
type Viewer = { id: string; name: string; email: string; role?: string };
type CustomField = {
  id: string;
  title: string;
  type:
    | "TEXT"
    | "TEXTAREA"
    | "NUMBER"
    | "DATE"
    | "SELECT"
    | "RADIO"
    | "CHECKBOX";
  required: boolean;
  options: string[];
};
type RegistrationForm = {
  id: string;
  eventName: string;
  description: string;
  photoUrl: string | null;
  slug: string;
  active: boolean;
  eventDates: EventDate[];
  creator: { id: string; name: string };
  viewers: Viewer[];
  customFields: CustomField[];
  _count: { submissions: number };
};
type Submission = {
  id: string;
  registrantName: string;
  identity: string;
  contact: string;
  origin: string;
  createdAt: string;
  unregisteredAt: string | null;
  customAnswers: Record<string, string | number | boolean | string[]>;
  attendances: {
    id: string;
    totalPersons: number;
    meal: boolean;
    eventDate: EventDate;
  }[];
};
type Detail = RegistrationForm & { submissions: Submission[] };
const empty = {
  eventName: "",
  description: "",
  photoUrl: null,
  photoDataUrl: "",
  removePhoto: false,
  active: true,
  eventDates: [""],
  viewerIds: [] as string[],
  customFields: [] as CustomField[],
};
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const day = (value: string) => value.slice(0, 10);

export default function RegistrationManagement() {
  const allowed = useAuthorities("registrations");
  const nav = useNavigate(),
    current = session(),
    token = current?.token;
  const [forms, setForms] = useState<RegistrationForm[]>([]),
    [editor, setEditor] = useState<any>(null),
    [detail, setDetail] = useState<Detail | null>(null);
  const [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false),
    [viewerOptions, setViewerOptions] = useState<Viewer[]>([]),
    [hideUnregistered, setHideUnregistered] = useState(true);
  const [viewerQuery, setViewerQuery] = useState("");
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    const data =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const load = async () => {
    try {
      const capability = await api("/api/registrations/capability");
      setCanManage(capability.canManage);
      const assignedForms = await api("/api/registrations/admin/forms");
      setForms(assignedForms);
      if (capability.canManage)
        setViewerOptions(await api("/api/registrations/admin/viewer-options"));
    } catch (error: any) {
      flash(error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const open = (form?: RegistrationForm) => {
    if (!canManage) return;
    setViewerQuery("");
    setEditor(
      form
        ? {
            ...form,
            customFields: Array.isArray(form.customFields)
              ? form.customFields
              : [],
            viewerIds: form.viewers.map((viewer) => viewer.id),
            photoDataUrl: "",
            removePhoto: false,
            eventDates: form.eventDates.map((item) => day(item.eventDate)),
          }
        : {
            ...empty,
            eventDates: [...empty.eventDates],
            viewerIds: [],
            customFields: [],
          },
    );
  };
  const addCustomField = () =>
    setEditor((current: any) => ({
      ...current,
      customFields: [
        ...current.customFields,
        {
          id: `field-${crypto.randomUUID()}`,
          title: "",
          type: "TEXT",
          required: false,
          options: [],
        },
      ],
    }));
  const updateCustomField = (id: string, changes: Partial<CustomField>) =>
    setEditor((current: any) => ({
      ...current,
      customFields: current.customFields.map((field: CustomField) =>
        field.id === id ? { ...field, ...changes } : field,
      ),
    }));
  const selectPhoto = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return flash("Use a PNG, JPEG, or WebP photo");
    if (file.size > 5 * 1024 * 1024)
      return flash("Photo must be 5 MB or smaller");
    const reader = new FileReader();
    reader.onload = () =>
      setEditor((current: any) =>
        current
          ? {
              ...current,
              photoDataUrl: String(reader.result || ""),
              removePhoto: false,
            }
          : current,
      );
    reader.onerror = () => flash("Could not read photo");
    reader.readAsDataURL(file);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const editing = Boolean(editor.id),
        body = {
          eventName: editor.eventName,
          description: editor.description,
          active: editor.active,
          eventDates: editor.eventDates.filter(Boolean),
          viewerIds: editor.viewerIds,
          customFields: editor.customFields,
        };
      let saved = await api(
        `/api/registrations/admin/forms${editing ? `/${editor.id}` : ""}`,
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      if (editor.photoDataUrl)
        saved = await api(`/api/registrations/admin/forms/${saved.id}/photo`, {
          method: "POST",
          body: JSON.stringify({ dataUrl: editor.photoDataUrl }),
        });
      else if (editor.removePhoto && saved.photoUrl)
        saved = await api(`/api/registrations/admin/forms/${saved.id}/photo`, {
          method: "DELETE",
        });
      setForms((items) =>
        editing
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...items],
      );
      setEditor(null);
      flash(
        editing ? "Registration form updated" : "Registration form created",
      );
    } catch (error: any) {
      flash(error.message);
    }
  };
  const remove = async (form: RegistrationForm) => {
    if (!confirm(`Delete “${form.eventName}” and all registrations?`)) return;
    try {
      await api(`/api/registrations/admin/forms/${form.id}`, {
        method: "DELETE",
      });
      setForms((items) => items.filter((item) => item.id !== form.id));
      flash("Registration form deleted");
    } catch (error: any) {
      flash(error.message);
    }
  };
  const showResponses = async (form: RegistrationForm) => {
    try {
      setDetail(
        await api(`/api/registrations/admin/forms/${form.id}/submissions`),
      );
    } catch (error: any) {
      flash(error.message);
    }
  };
  const exportResponses = async (
    form: RegistrationForm,
    loadedDetail?: Detail,
  ) => {
    if (!canManage) return;
    try {
      const exportDetail =
        loadedDetail ||
        (await api(`/api/registrations/admin/forms/${form.id}/submissions`));
      const blob = new Blob([registrationCsv(exportDetail)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = registrationCsvFilename(exportDetail.eventName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      flash("Registration CSV exported");
    } catch (error: any) {
      flash(error.message);
    }
  };
  const editAttendance = (
    submissionId: string,
    attendanceId: string,
    changes: Partial<Submission["attendances"][number]>,
  ) =>
    setDetail((current) =>
      current
        ? {
            ...current,
            submissions: current.submissions.map((submission) =>
              submission.id === submissionId
                ? {
                    ...submission,
                    attendances: submission.attendances.map((item) =>
                      item.id === attendanceId ? { ...item, ...changes } : item,
                    ),
                  }
                : submission,
            ),
          }
        : current,
    );
  const updateSubmission = async (submission: Submission) => {
    try {
      const saved = await api(
        `/api/registrations/admin/submissions/${submission.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            attendances: submission.attendances.map(
              ({ id, totalPersons, meal }) => ({ id, totalPersons, meal }),
            ),
          }),
        },
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              submissions: current.submissions.map((item) =>
                item.id === saved.id ? saved : item,
              ),
            }
          : current,
      );
      flash("Registration updated");
    } catch (error: any) {
      flash(error.message);
    }
  };
  const unregister = async (submission: Submission) => {
    if (!confirm(`Un-register ${submission.registrantName}?`)) return;
    try {
      const saved = await api(
        `/api/registrations/admin/submissions/${submission.id}`,
        { method: "DELETE" },
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              submissions: current.submissions.map((item) =>
                item.id === saved.id ? saved : item,
              ),
            }
          : current,
      );
      setForms((items) =>
        items.map((form) =>
          form.id === detail?.id
            ? {
                ...form,
                _count: {
                  submissions: Math.max(0, form._count.submissions - 1),
                },
              }
            : form,
        ),
      );
      flash("Registrant marked as un-registered");
    } catch (error: any) {
      flash(error.message);
    }
  };
  const copyLink = async (form: RegistrationForm) => {
    const url = `${window.location.origin}/registration/${form.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Share link copied");
    } catch {
      window.prompt("Copy this registration link", url);
    }
  };
  const initials =
    current?.user?.name
      ?.split(" ")
      .map((part: string) => part[0])
      .slice(0, 2)
      .join("") || "LN";
  const activeSubmissions =
    detail?.submissions.filter((submission) => !submission.unregisteredAt) ||
    [];
  const visibleSubmissions =
    detail?.submissions.filter(
      (submission) => !hideUnregistered || !submission.unregisteredAt,
    ) || [];
  const filteredViewerOptions = viewerOptions.filter((viewer) =>
    `${viewer.name} ${viewer.email} ${viewer.role || ""}`
      .toLowerCase()
      .includes(viewerQuery.trim().toLowerCase()),
  );
  const registeredPersons = activeSubmissions.reduce(
    (total, submission) =>
      total +
      submission.attendances.reduce(
        (sum, attendance) => sum + Number(attendance.totalPersons || 0),
        0,
      ),
    0,
  );
  const eventDateSummaries =
    detail?.eventDates.map((eventDate) =>
      activeSubmissions.reduce(
        (summary, submission) => {
          const attendance = submission.attendances.find(
            (item) => item.eventDate.id === eventDate.id,
          );
          if (!attendance) return summary;
          const persons = Number(attendance.totalPersons || 0);
          return {
            ...summary,
            registered: summary.registered + persons,
            volunteers:
              summary.volunteers +
              (submission.identity === "VOLUNTEER" ? persons : 0),
            nonVolunteers:
              summary.nonVolunteers +
              (submission.identity === "VOLUNTEER" ? 0 : persons),
            meals: summary.meals + (attendance.meal ? persons : 0),
          };
        },
        {
          eventDate,
          registered: 0,
          volunteers: 0,
          nonVolunteers: 0,
          meals: 0,
        },
      ),
    ) || [];
  return (
    <div className="dash registrationAdmin">
      <aside>
        <Link to="/" className="brand light">
          <span>LN</span>
          <div>
            LOCAL NEWS<small>NEWSROOM OS</small>
          </div>
        </Link>
        <div className="workspace">
          <small>WORKSPACE</small>
          <b>{current?.user?.name}</b>
        </div>
        <button data-session-common="true" onClick={() => nav("/newsroom")}>
          <LayoutDashboard />
          Overview
        </button>
        <button data-session-common="true">
          <FileText />
          Stories
        </button>
        <button data-session-common="true">
          <Users />
          People
        </button>
        <button data-session-common="true" className="active">
          <ClipboardList />
          Registration
        </button>
        <button data-session-common="true">
          <Settings />
          Settings
        </button>
        <div className="profile">
          <div>{initials}</div>
          <span>
            <b>{current?.user?.name}</b>
            <small>{current?.user?.role}</small>
          </span>
        </div>
      </aside>
      <section className="content registrationContent">
        <div className="top">
          <div>
            <small>ADMINISTRATION / REGISTRATION · 管理 / 登记</small>
            <h1>Registration forms / 登记表格</h1>
            <p>
              {canManage
                ? "Create event forms, share public links and review pre-registrations."
                : "View registrations for forms assigned to you."}
            </p>
          </div>
          {allowed("new") && (
            <button
              className="new"
              disabled={!canManage}
              onClick={() => open()}
              title={
                canManage ? "Create registration form" : "View-only access"
              }
            >
              <Plus />
              New form / 新建表格
            </button>
          )}
        </div>
        {notice && (
          <div className="toast">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        <div className="registrationSummary">
          <div>
            <b>{forms.length}</b>
            <span>Forms / 表格</span>
          </div>
          <div>
            <b>{forms.filter((form) => form.active).length}</b>
            <span>Open / 开放</span>
          </div>
          <div>
            <b>
              {forms.reduce((sum, form) => sum + form._count.submissions, 0)}
            </b>
            <span>Registrations / 登记</span>
          </div>
        </div>
        <div className="registrationGrid">
          {loading && (
            <div className="registrationEmpty">Loading registration forms…</div>
          )}
          {!loading && !forms.length && (
            <div className="registrationEmpty">
              <ClipboardList />
              <h2>
                {canManage
                  ? "No registration forms yet"
                  : "No registration forms assigned"}
              </h2>
              <p>
                {canManage
                  ? "Create the first form to receive outsider pre-registrations."
                  : "Registration will appear here after an administrator assigns a form to you."}
              </p>
              {allowed("new") && (
                <button
                  className="new"
                  disabled={!canManage}
                  onClick={() => open()}
                >
                  <Plus />
                  New form
                </button>
              )}
            </div>
          )}
          {forms.map((form) => (
            <article className="registrationCard" key={form.id}>
              <div className="registrationCardHead">
                <span className={form.active ? "open" : "closed"}>
                  {form.active ? "Open" : "Closed"}
                </span>
                <small>{form._count.submissions} registrations</small>
              </div>
              <h2>{form.eventName}</h2>
              <p>{form.description}</p>
              <div className="registrationDates">
                {form.eventDates.map((item) => (
                  <span key={item.id}>
                    <CalendarDays />
                    {new Date(item.eventDate).toLocaleDateString()}
                  </span>
                ))}
              </div>
              <small>Created by {form.creator.name}</small>
              <div className="registrationCardActions">
                {allowed("view") && (
                  <button
                    onClick={() => showResponses(form)}
                    title="View registrations"
                  >
                    <Eye />
                  </button>
                )}
                {canManage && (
                  <button
                    onClick={() => exportResponses(form)}
                    title="Export all fields to CSV"
                  >
                    <Download />
                  </button>
                )}
                {allowed("copy_link") && (
                  <button
                    disabled={!canManage}
                    onClick={() => canManage && copyLink(form)}
                    title={canManage ? "Copy public link" : "View-only access"}
                  >
                    <Copy />
                  </button>
                )}
                {allowed("edit") && (
                  <button
                    disabled={!canManage}
                    onClick={() => open(form)}
                    title={canManage ? "Edit form" : "View-only access"}
                  >
                    <Pencil />
                  </button>
                )}
                {allowed("delete") && (
                  <button
                    disabled={!canManage}
                    className="danger"
                    onClick={() => canManage && remove(form)}
                    title={canManage ? "Delete form" : "View-only access"}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {editor && (
        <div className="modalBackdrop" onMouseDown={() => setEditor(null)}>
          <form
            className="registrationEditor"
            onSubmit={save}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modalHead">
              <div>
                <small>{editor.id ? "EDIT FORM" : "NEW FORM"}</small>
                <h2>
                  {editor.id
                    ? "Edit registration form"
                    : "Create registration form"}
                </h2>
              </div>
              <button type="button" onClick={() => setEditor(null)}>
                <X />
              </button>
            </div>
            <section className="registrationPhotoEditor">
              <div
                className={
                  editor.photoDataUrl ||
                  (editor.photoUrl && !editor.removePhoto)
                    ? "hasPhoto"
                    : ""
                }
                style={
                  editor.photoDataUrl ||
                  (editor.photoUrl && !editor.removePhoto)
                    ? {
                        backgroundImage: `url(${editor.photoDataUrl || editor.photoUrl})`,
                      }
                    : undefined
                }
              >
                <ImagePlus />
              </div>
              <span>
                <b>Form photo / 表格照片</b>
                <small>PNG, JPEG or WebP · maximum 5 MB</small>
                <label>
                  <ImagePlus />
                  {editor.photoUrl || editor.photoDataUrl
                    ? "Replace photo / 更换照片"
                    : "Upload photo / 上传照片"}
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => selectPhoto(event.target.files?.[0])}
                  />
                </label>
                {(editor.photoUrl || editor.photoDataUrl) &&
                  !editor.removePhoto && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({
                          ...editor,
                          photoDataUrl: "",
                          removePhoto: true,
                        })
                      }
                    >
                      <Trash2 />
                      Remove photo / 移除照片
                    </button>
                  )}
              </span>
            </section>
            <label>
              Event name
              <input
                required
                minLength={2}
                maxLength={160}
                value={editor.eventName}
                onChange={(event) =>
                  setEditor({ ...editor, eventName: event.target.value })
                }
              />
            </label>
            <label>
              Description
              <textarea
                required
                minLength={2}
                maxLength={5000}
                rows={5}
                value={editor.description}
                onChange={(event) =>
                  setEditor({ ...editor, description: event.target.value })
                }
              />
            </label>
            <fieldset>
              <legend>Event dates</legend>
              {editor.eventDates.map((value: string, index: number) => (
                <div className="registrationDateInput" key={index}>
                  <input
                    type="date"
                    required
                    value={value}
                    onChange={(event) =>
                      setEditor({
                        ...editor,
                        eventDates: editor.eventDates.map(
                          (item: string, itemIndex: number) =>
                            itemIndex === index ? event.target.value : item,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    disabled={editor.eventDates.length === 1}
                    onClick={() =>
                      setEditor({
                        ...editor,
                        eventDates: editor.eventDates.filter(
                          (_: string, itemIndex: number) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
              <button
                className="addDate"
                type="button"
                onClick={() =>
                  setEditor({
                    ...editor,
                    eventDates: [...editor.eventDates, ""],
                  })
                }
              >
                <Plus />
                Add another date
              </button>
            </fieldset>
            <fieldset className="registrationCustomFields">
              <legend>Additional form fields</legend>
              <p>
                Add questions for different event types, similar to Google
                Forms.
              </p>
              {editor.customFields.map((field: CustomField, index: number) => (
                <section key={field.id}>
                  <b>Field {index + 1}</b>
                  <label>
                    Title
                    <input
                      required
                      maxLength={160}
                      value={field.title}
                      onChange={(event) =>
                        updateCustomField(field.id, {
                          title: event.target.value,
                        })
                      }
                      placeholder="Question or field title"
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={field.type}
                      onChange={(event) =>
                        updateCustomField(field.id, {
                          type: event.target.value as CustomField["type"],
                          options: ["SELECT", "RADIO", "CHECKBOX"].includes(
                            event.target.value,
                          )
                            ? field.options
                            : [],
                        })
                      }
                    >
                      <option value="TEXT">Short text</option>
                      <option value="TEXTAREA">Paragraph</option>
                      <option value="NUMBER">Number</option>
                      <option value="DATE">Date</option>
                      <option value="SELECT">Dropdown</option>
                      <option value="RADIO">Multiple choice</option>
                      <option value="CHECKBOX">Checkboxes</option>
                    </select>
                  </label>
                  {["SELECT", "RADIO", "CHECKBOX"].includes(field.type) && (
                    <label className="registrationFieldOptions">
                      Options
                      <textarea
                        required
                        rows={3}
                        value={field.options.join("\n")}
                        onChange={(event) =>
                          updateCustomField(field.id, {
                            options: event.target.value
                              .split("\n")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder={"One option per line\nOption 1\nOption 2"}
                      />
                    </label>
                  )}
                  <label className="registrationFieldRequired">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) =>
                        updateCustomField(field.id, {
                          required: event.target.checked,
                        })
                      }
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      setEditor({
                        ...editor,
                        customFields: editor.customFields.filter(
                          (item: CustomField) => item.id !== field.id,
                        ),
                      })
                    }
                  >
                    <Trash2 />
                    Remove
                  </button>
                </section>
              ))}
              <button
                className="addDate"
                type="button"
                onClick={addCustomField}
              >
                <Plus />
                Add field
              </button>
            </fieldset>
            <label className="registrationSwitch">
              <input
                type="checkbox"
                checked={editor.active}
                onChange={(event) =>
                  setEditor({ ...editor, active: event.target.checked })
                }
              />
              <span />
              Public form is open
            </label>
            <fieldset className="registrationViewerAssignment">
              <legend>View-only users</legend>
              <p>Assigned users can only view registrations for this form.</p>
              <label className="registrationViewerSearch">
                <Search />
                <input
                  type="search"
                  value={viewerQuery}
                  onChange={(event) => setViewerQuery(event.target.value)}
                  placeholder="Search by name, email or role"
                  aria-label="Search view-only users"
                />
              </label>
              <div>
                {filteredViewerOptions.map((viewer) => (
                  <label key={viewer.id}>
                    <input
                      type="checkbox"
                      checked={editor.viewerIds.includes(viewer.id)}
                      onChange={(event) =>
                        setEditor({
                          ...editor,
                          viewerIds: event.target.checked
                            ? [...editor.viewerIds, viewer.id]
                            : editor.viewerIds.filter(
                                (id: string) => id !== viewer.id,
                              ),
                        })
                      }
                    />
                    <span>
                      <b>{viewer.name}</b>
                      <small>
                        {viewer.email} · {viewer.role}
                      </small>
                    </span>
                  </label>
                ))}
                {!filteredViewerOptions.length && (
                  <small className="registrationViewerEmpty">
                    No users match your search.
                  </small>
                )}
              </div>
            </fieldset>
            <div className="modalActions">
              <button type="button" onClick={() => setEditor(null)}>
                Cancel
              </button>
              <button className="new" type="submit">
                {editor.id ? "Save changes" : "Create form"}
              </button>
            </div>
          </form>
        </div>
      )}
      {detail && (
        <div className="modalBackdrop" onMouseDown={() => setDetail(null)}>
          <section
            className="registrationResponses"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modalHead">
              <div>
                <small>REGISTRATIONS / 登记名单</small>
                <h2>{detail.eventName}</h2>
              </div>
              <button onClick={() => setDetail(null)}>
                <X />
              </button>
            </div>
            {canManage && (
              <button
                className="registrationExportButton"
                onClick={() => exportResponses(detail, detail)}
              >
                <Download />
                Export all fields / 导出全部字段
              </button>
            )}
            <div className="responseTotal">
              <span>Total persons registered / 已登记总人数</span>
              <strong>{registeredPersons}</strong>
            </div>
            <label className="registrationResponseFilter">
              <input
                type="checkbox"
                checked={hideUnregistered}
                onChange={(event) => setHideUnregistered(event.target.checked)}
              />
              Hide un-registered registrations / 隐藏已取消登记
            </label>
            <section
              className="responseDateSummaries"
              aria-label="Registration summary by event date"
            >
              {eventDateSummaries.map((summary) => (
                <article key={summary.eventDate.id}>
                  <strong>
                    {new Date(summary.eventDate.eventDate).toLocaleDateString(
                      undefined,
                      {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </strong>
                  <div>
                    <div className="registeredIdentitySummary">
                      <span>
                        Total Registered / 登记总人数
                        <b>{summary.registered}</b>
                      </span>
                      <small>
                        Volunteer / 志工 <b>{summary.volunteers}</b>
                      </small>
                      <small>
                        Non-Volunteer / 非志工 <b>{summary.nonVolunteers}</b>
                      </small>
                    </div>
                    <span>
                      Total require Meal / 需要用餐总人数<b>{summary.meals}</b>
                    </span>
                  </div>
                </article>
              ))}
            </section>
            {!detail.submissions.length && (
              <div className="registrationEmpty">
                No pre-registrations received yet. / 暂无预登记。
              </div>
            )}
            <div className="responseList">
              {visibleSubmissions.map((submission) => (
                <article
                  className={submission.unregisteredAt ? "unregistered" : ""}
                  key={submission.id}
                >
                  <header>
                    <div>
                      <b>{submission.registrantName}</b>
                      <small>
                        {submission.identity === "VOLUNTEER"
                          ? "Volunteer / 志工"
                          : "Non-Volunteer / 非志工"}{" "}
                        · {submission.origin}
                      </small>
                    </div>
                    <div className="responseRegistrationStatus">
                      <span>
                        {submission.unregisteredAt
                          ? "Un-registered / 已取消登记"
                          : "Registered / 已登记"}
                      </span>
                      <time>
                        {new Date(submission.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </header>
                  <p>{submission.contact}</p>
                  {detail.customFields?.length > 0 && (
                    <dl className="registrationCustomAnswers">
                      {detail.customFields.map((field) => (
                        <div key={field.id}>
                          <dt>{field.title}</dt>
                          <dd>
                            {Array.isArray(submission.customAnswers?.[field.id])
                              ? (
                                  submission.customAnswers[field.id] as string[]
                                ).join(", ")
                              : String(
                                  submission.customAnswers?.[field.id] ?? "—",
                                )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="responseAttendances">
                    {submission.attendances.map((attendance) => (
                      <div key={attendance.id}>
                        <strong>
                          {new Date(
                            attendance.eventDate.eventDate,
                          ).toLocaleDateString()}
                        </strong>
                        <label>
                          Persons / 人数
                          <input
                            disabled={
                              !canManage || Boolean(submission.unregisteredAt)
                            }
                            type="number"
                            min={1}
                            max={999}
                            value={attendance.totalPersons}
                            onChange={(event) =>
                              editAttendance(submission.id, attendance.id, {
                                totalPersons: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Meal / 用餐
                          <select
                            disabled={
                              !canManage || Boolean(submission.unregisteredAt)
                            }
                            value={attendance.meal ? "yes" : "no"}
                            onChange={(event) =>
                              editAttendance(submission.id, attendance.id, {
                                meal: event.target.value === "yes",
                              })
                            }
                          >
                            <option value="no">No / 否</option>
                            <option value="yes">Yes / 是</option>
                          </select>
                        </label>
                      </div>
                    ))}
                  </div>
                  {submission.unregisteredAt ? (
                    <small className="unregisteredDate">
                      Un-registered{" "}
                      {new Date(submission.unregisteredAt).toLocaleString()}
                    </small>
                  ) : canManage ? (
                    <div className="responseActions">
                      <button
                        type="button"
                        onClick={() => updateSubmission(submission)}
                      >
                        Save changes / 保存更改
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => unregister(submission)}
                      >
                        <Trash2 />
                        Un-register / 取消登记
                      </button>
                    </div>
                  ) : (
                    <small className="registrationViewOnlyNote">
                      View-only access
                    </small>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
