import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
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
  QrCode,
  Save,
  Search,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuthorities } from "./menuAccess";
import { registrationCsv, registrationCsvFilename } from "./registrationCsv";
import { buildAttendanceQrUrl } from "./attendanceQr";
import {
  cleanRegistrationOptionLines,
  splitRegistrationOptionLines,
} from "./registrationFieldOptions";
import { type RegistrationQuantityAnswer } from "./registrationAnswers";
import { registrationFieldSummaries } from "./registrationSummary";
import RegistrationAnswersEditor, {
  type EditableRegistrationAnswer,
} from "./RegistrationAnswersEditor";

type EventDate = { id: string; eventDate: string };
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
    | "CHECKBOX"
    | "RADIO_QUANTITY"
    | "CHECKBOX_QUANTITY";
  required: boolean;
  countInSummary?: boolean;
  options: string[];
};
type RegistrationForm = {
  id: string;
  eventName: string;
  description: string;
  photoUrl: string | null;
  slug: string;
  active: boolean;
  showRegistrantList: boolean;
  eventDates: EventDate[];
  creator: { id: string; name: string };
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
  roles: string[];
  customAnswers: Record<string, string | number | boolean | string[] | RegistrationQuantityAnswer>;
  attendances: {
    id: string;
    totalPersons: number;
    meal: boolean;
    checkedInAt?: string | null;
    eventDate: EventDate;
  }[];
};
type Detail = RegistrationForm & { submissions: Submission[] };
type AttendanceCodes = {
  id: string;
  eventName: string;
  eventDates: (EventDate & { token: string })[];
};
const empty = {
  eventName: "",
  description: "",
  photoUrl: null,
  photoDataUrl: "",
  removePhoto: false,
  active: true,
  showRegistrantList: false,
  eventDates: [],
  customFields: [] as CustomField[],
};
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const day = (value: string) => value.slice(0, 10);
const roleLabel = (role: string) =>
  role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const submissionSignature = (submission: Submission) =>
  JSON.stringify({
    registrantName: submission.registrantName,
    identity: submission.identity,
    contact: submission.contact,
    origin: submission.origin,
    customAnswers: submission.customAnswers,
    attendances: submission.attendances.map(({ id, totalPersons, meal }) => ({
      id,
      totalPersons,
      meal,
    })),
  });

function AttendanceQrImage({ token, label }: { token: string; label: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let current = true;
    QRCode.toDataURL(buildAttendanceQrUrl(token, window.location.origin), {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#143f31", light: "#ffffff" },
    }).then((value) => current && setSource(value));
    return () => {
      current = false;
    };
  }, [token]);
  return source ? (
    <>
      <img src={source} alt={`Attendance QR for ${label}`} />
      <a href={source} download={`${label.replace(/[^a-z0-9-]+/gi, "-")}-attendance-qr.png`}>
        <Download />
        Download QR
      </a>
    </>
  ) : (
    <span className="registrationQrLoading">Generating QR…</span>
  );
}

export default function RegistrationManagement() {
  const allowed = useAuthorities("registrations");
  const nav = useNavigate(),
    current = session(),
    token = current?.token;
  const [forms, setForms] = useState<RegistrationForm[]>([]),
    [editor, setEditor] = useState<any>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [attendanceCodes, setAttendanceCodes] = useState<AttendanceCodes | null>(null);
  const [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false),
    [hideUnregistered, setHideUnregistered] = useState(true);
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [savedSubmissions, setSavedSubmissions] = useState<Record<string, string>>({});
  const [savingSubmission, setSavingSubmission] = useState("");
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
    setEditor(
      form
        ? {
            ...form,
            customFields: Array.isArray(form.customFields)
              ? form.customFields
              : [],
            photoDataUrl: "",
            removePhoto: false,
            eventDates: form.eventDates.map((item) => day(item.eventDate)),
          }
        : {
            ...empty,
            eventDates: [...empty.eventDates],
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
          countInSummary: false,
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
          showRegistrantList: Boolean(editor.showRegistrantList),
          eventDates: editor.eventDates.filter(Boolean),
          customFields: editor.customFields.map((field: CustomField) => ({
            ...field,
            options: cleanRegistrationOptionLines(field.options),
          })),
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
      const loaded = await api(`/api/registrations/admin/forms/${form.id}/submissions`);
      setRegistrationSearch("");
      setSavedSubmissions(
        Object.fromEntries(
          loaded.submissions.map((submission: Submission) => [
            submission.id,
            submissionSignature(submission),
          ]),
        ),
      );
      setDetail(loaded);
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
  const showAttendanceCodes = async (form: RegistrationForm) => {
    if (!canManage) return;
    try {
      setAttendanceCodes(
        await api(`/api/registrations/admin/forms/${form.id}/attendance-codes`),
      );
    } catch (error: any) {
      flash(error.message);
    }
  };
  const editSubmission = (
    submissionId: string,
    changes: Partial<Submission>,
  ) =>
    setDetail((current) =>
      current
        ? {
            ...current,
            submissions: current.submissions.map((submission) =>
              submission.id === submissionId
                ? { ...submission, ...changes }
                : submission,
            ),
          }
        : current,
    );
  const editCustomAnswer = (
    submission: Submission,
    fieldId: string,
    value: EditableRegistrationAnswer,
  ) =>
    editSubmission(submission.id, {
      customAnswers: { ...submission.customAnswers, [fieldId]: value },
    });
  const updateSubmission = async (submission: Submission) => {
    setSavingSubmission(submission.id);
    try {
      const saved = await api(
        `/api/registrations/admin/submissions/${submission.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            registrantName: submission.registrantName,
            identity: submission.identity,
            contact: submission.contact,
            origin: submission.origin,
            customAnswers: submission.customAnswers,
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
      setSavedSubmissions((current) => ({
        ...current,
        [saved.id]: submissionSignature(saved),
      }));
      flash("Registration updated");
    } catch (error: any) {
      flash(error.message);
    } finally {
      setSavingSubmission("");
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
      (submission) => {
        if (hideUnregistered && submission.unregisteredAt) return false;
        const query = registrationSearch.trim().toLowerCase();
        if (!query) return true;
        const queryDigits = query.replace(/\D/g, "");
        const contactDigits = submission.contact.replace(/\D/g, "");
        return (
          submission.registrantName.toLowerCase().includes(query) ||
          submission.contact.toLowerCase().includes(query) ||
          Boolean(queryDigits && contactDigits.includes(queryDigits))
        );
      },
    ) || [];
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
  const customFieldSummaries = registrationFieldSummaries(
    detail?.customFields || [],
    activeSubmissions,
  );
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
            <p>Create event forms, share public links and review pre-registrations.</p>
          </div>
          {canManage && allowed("new") && (
            <button
              className="new"
              onClick={() => open()}
              title="Create registration form"
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
              <h2>No registration forms yet</h2>
              <p>Create the first form to receive outsider pre-registrations.</p>
              {canManage && allowed("new") && (
                <button
                  className="new"
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
                {canManage && (
                  <button
                    onClick={() => showAttendanceCodes(form)}
                    title="Attendance QR codes"
                  >
                    <QrCode />
                  </button>
                )}
                {canManage && allowed("copy_link") && (
                  <button
                    onClick={() => copyLink(form)}
                    title="Copy public link"
                  >
                    <Copy />
                  </button>
                )}
                {canManage && allowed("edit") && (
                  <button
                    onClick={() => open(form)}
                    title="Edit form"
                  >
                    <Pencil />
                  </button>
                )}
                {canManage && allowed("delete") && (
                  <button
                    className="danger"
                    onClick={() => remove(form)}
                    title="Delete form"
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      {editor && createPortal(
        <div className="modalBackdrop registrationModalBackdrop" onMouseDown={() => setEditor(null)}>
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
                          countInSummary: ["NUMBER", "RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(event.target.value)
                            ? Boolean(field.countInSummary)
                            : false,
                          options: ["SELECT", "RADIO", "CHECKBOX", "RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(
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
                      <option value="RADIO_QUANTITY">Multiple choice with Quantity</option>
                      <option value="CHECKBOX_QUANTITY">Checkboxes with Quantity</option>
                    </select>
                  </label>
                  {["SELECT", "RADIO", "CHECKBOX", "RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(field.type) && (
                    <label className="registrationFieldOptions">
                      Options
                      <textarea
                        required
                        rows={3}
                        value={field.options.join("\n")}
                        onChange={(event) =>
                          updateCustomField(field.id, {
                            options: splitRegistrationOptionLines(
                              event.target.value,
                            ),
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
                  {["NUMBER", "RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(field.type) && (
                    <label className="registrationFieldRequired registrationFieldSummaryCount">
                      <input
                        type="checkbox"
                        checked={Boolean(field.countInSummary)}
                        onChange={(event) =>
                          updateCustomField(field.id, {
                            countInSummary: event.target.checked,
                          })
                        }
                      />
                      Count in summary
                    </label>
                  )}
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
            <label className="registrationRegistrantVisibility">
              <input
                type="checkbox"
                checked={Boolean(editor.showRegistrantList)}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    showRegistrantList: event.target.checked,
                  })
                }
              />
              Allow registrants to see the registered-name list
            </label>
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
            <div className="modalActions">
              <button type="button" onClick={() => setEditor(null)}>
                Cancel
              </button>
              <button className="new" type="submit">
                {editor.id ? "Save changes" : "Create form"}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
      {detail && createPortal(
        <div className="modalBackdrop registrationModalBackdrop" onMouseDown={() => setDetail(null)}>
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
            {customFieldSummaries.length > 0 && (
              <section
                className="registrationCustomSummary"
                aria-label="Custom field totals"
              >
                {customFieldSummaries.map((summary) => (
                  <article key={summary.id}>
                    <header>
                      <span>Total {summary.title}</span>
                      <strong>{summary.total}</strong>
                    </header>
                    <div className="registrationCustomSummaryIdentity">
                      <span>
                        Volunteer / 志工
                        <b>{summary.volunteers}</b>
                      </span>
                      <span>
                        Non-Volunteer / 非志工
                        <b>{summary.nonVolunteers}</b>
                      </span>
                    </div>
                    {summary.breakdown.length > 0 && (
                      <div className="registrationCustomSummaryOptions">
                        {summary.breakdown.map((option) => (
                          <span key={option.label}>
                            <span>
                              {option.label}
                              <b>{option.total}</b>
                            </span>
                            <small>
                              Volunteer / 志工 <b>{option.volunteers}</b>
                            </small>
                            <small>
                              Non-Volunteer / 非志工 <b>{option.nonVolunteers}</b>
                            </small>
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}
            <div className="registrationResponseTools">
              <label className="registrationResponseSearch">
                <Search />
                <input
                  type="search"
                  value={registrationSearch}
                  onChange={(event) => setRegistrationSearch(event.target.value)}
                  placeholder="Search registrant name or mobile number"
                  aria-label="Search registrant by name or mobile number"
                />
              </label>
              <label className="registrationResponseFilter">
                <input
                  type="checkbox"
                  checked={hideUnregistered}
                  onChange={(event) => setHideUnregistered(event.target.checked)}
                />
                Hide un-registered registrations / 隐藏已取消登记
              </label>
            </div>
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
                    <div className="responseRegistrantDetails">
                      <span>
                        Name / 姓名: <b>{submission.registrantName}</b>
                      </span>
                      <span>
                        Role / 角色:{" "}
                        <b>
                          {submission.roles?.length
                            ? submission.roles.map(roleLabel).join(", ")
                            : "—"}
                        </b>
                      </span>
                      <span className="responseRegistrantMobile">
                        Mobile number / 手机号码: <b>{submission.contact}</b>
                        {!submission.unregisteredAt &&
                          savedSubmissions[submission.id] !==
                            submissionSignature(submission) && (
                            <button
                              type="button"
                              disabled={savingSubmission === submission.id}
                              onClick={() => updateSubmission(submission)}
                            >
                              <Save />
                              {savingSubmission === submission.id
                                ? "Saving…"
                                : "Save changes / 保存更改"}
                            </button>
                          )}
                      </span>
                    </div>
                    <div className="responseRegistrationStatus">
                      <div>
                        <span>
                          {submission.unregisteredAt
                            ? "Un-registered / 已取消登记"
                            : "Registered / 已登记"}
                        </span>
                        {!submission.unregisteredAt && (
                          <button
                            type="button"
                            className="responseUnregisterButton"
                            onClick={() => unregister(submission)}
                          >
                            Un-register
                          </button>
                        )}
                      </div>
                      <time>
                        {new Date(submission.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </header>
                  {detail.customFields?.length > 0 && (
                    <section className="responseCustomFields">
                      <strong>Additional fields / 其他资料</strong>
                      <RegistrationAnswersEditor
                        fields={detail.customFields}
                        answers={submission.customAnswers}
                        disabled={Boolean(submission.unregisteredAt)}
                        onChange={(fieldId, value) =>
                          editCustomAnswer(submission, fieldId, value)
                        }
                      />
                    </section>
                  )}
                  {submission.unregisteredAt && (
                    <small className="unregisteredDate">
                      Un-registered{" "}
                      {new Date(submission.unregisteredAt).toLocaleString()}
                    </small>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>,
        document.body,
      )}
      {attendanceCodes && createPortal(
        <div
          className="modalBackdrop registrationModalBackdrop"
          onMouseDown={() => setAttendanceCodes(null)}
        >
          <section
            className="registrationQrModal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modalHead">
              <div>
                <small>ATTENDANCE QR / 出席二维码</small>
                <h2>{attendanceCodes.eventName}</h2>
              </div>
              <button onClick={() => setAttendanceCodes(null)}>
                <X />
              </button>
            </div>
            <p>
              Display the matching event-date code for registered users to scan
              from Your Appointments.
            </p>
            <div className="registrationQrGrid">
              {attendanceCodes.eventDates.map((eventDate) => {
                const label = day(eventDate.eventDate);
                return (
                  <article key={eventDate.id}>
                    <strong>
                      {new Date(eventDate.eventDate).toLocaleDateString(
                        undefined,
                        { weekday: "long", year: "numeric", month: "long", day: "numeric" },
                      )}
                    </strong>
                    <AttendanceQrImage token={eventDate.token} label={label} />
                    <small>Scan to mark attendance / 扫码签到</small>
                  </article>
                );
              })}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
