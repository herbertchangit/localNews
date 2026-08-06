import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, ClipboardList, Copy, Eye, FileText, ImagePlus, LayoutDashboard, Pencil, Plus, Settings, Trash2, Users, X } from "lucide-react";

type EventDate = { id: string; eventDate: string };
type RegistrationForm = {
  id: string;
  eventName: string;
  description: string;
  photoUrl: string | null;
  slug: string;
  active: boolean;
  eventDates: EventDate[];
  creator: { id: string; name: string };
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
  attendances: { id: string; totalPersons: number; meal: boolean; eventDate: EventDate }[];
};
type Detail = RegistrationForm & { submissions: Submission[] };
const empty = { eventName: "", description: "", photoUrl: null, photoDataUrl: "", removePhoto: false, active: true, eventDates: [""] };
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const day = (value: string) => value.slice(0, 10);

export default function RegistrationManagement() {
  const nav = useNavigate(), current = session(), token = current?.token;
  const [forms, setForms] = useState<RegistrationForm[]>([]), [editor, setEditor] = useState<any>(null), [detail, setDetail] = useState<Detail | null>(null);
  const [notice, setNotice] = useState(""), [loading, setLoading] = useState(true);
  const headers = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }), [token]);
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3500); };
  const load = async () => { try { setForms(await api("/api/registrations/admin/forms")); } catch (error: any) { flash(error.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const open = (form?: RegistrationForm) => setEditor(form ? { ...form, photoDataUrl: "", removePhoto: false, eventDates: form.eventDates.map((item) => day(item.eventDate)) } : { ...empty, eventDates: [...empty.eventDates] });
  const selectPhoto = (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return flash("Use a PNG, JPEG, or WebP photo");
    if (file.size > 5 * 1024 * 1024) return flash("Photo must be 5 MB or smaller");
    const reader = new FileReader();
    reader.onload = () => setEditor((current: any) => current ? { ...current, photoDataUrl: String(reader.result || ""), removePhoto: false } : current);
    reader.onerror = () => flash("Could not read photo");
    reader.readAsDataURL(file);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const editing = Boolean(editor.id), body = { eventName: editor.eventName, description: editor.description, active: editor.active, eventDates: editor.eventDates.filter(Boolean) };
      let saved = await api(`/api/registrations/admin/forms${editing ? `/${editor.id}` : ""}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      if (editor.photoDataUrl) saved = await api(`/api/registrations/admin/forms/${saved.id}/photo`, { method: "POST", body: JSON.stringify({ dataUrl: editor.photoDataUrl }) });
      else if (editor.removePhoto && saved.photoUrl) saved = await api(`/api/registrations/admin/forms/${saved.id}/photo`, { method: "DELETE" });
      setForms((items) => editing ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]);
      setEditor(null); flash(editing ? "Registration form updated" : "Registration form created");
    } catch (error: any) { flash(error.message); }
  };
  const remove = async (form: RegistrationForm) => {
    if (!confirm(`Delete “${form.eventName}” and all registrations?`)) return;
    try { await api(`/api/registrations/admin/forms/${form.id}`, { method: "DELETE" }); setForms((items) => items.filter((item) => item.id !== form.id)); flash("Registration form deleted"); } catch (error: any) { flash(error.message); }
  };
  const showResponses = async (form: RegistrationForm) => { try { setDetail(await api(`/api/registrations/admin/forms/${form.id}/submissions`)); } catch (error: any) { flash(error.message); } };
  const editAttendance = (submissionId: string, attendanceId: string, changes: Partial<Submission["attendances"][number]>) => setDetail((current) => current ? { ...current, submissions: current.submissions.map((submission) => submission.id === submissionId ? { ...submission, attendances: submission.attendances.map((item) => item.id === attendanceId ? { ...item, ...changes } : item) } : submission) } : current);
  const updateSubmission = async (submission: Submission) => {
    try {
      const saved = await api(`/api/registrations/admin/submissions/${submission.id}`, { method: "PATCH", body: JSON.stringify({ attendances: submission.attendances.map(({ id, totalPersons, meal }) => ({ id, totalPersons, meal })) }) });
      setDetail((current) => current ? { ...current, submissions: current.submissions.map((item) => item.id === saved.id ? saved : item) } : current);
      flash("Registration updated");
    } catch (error: any) { flash(error.message); }
  };
  const unregister = async (submission: Submission) => {
    if (!confirm(`Un-register ${submission.registrantName}?`)) return;
    try {
      const saved = await api(`/api/registrations/admin/submissions/${submission.id}`, { method: "DELETE" });
      setDetail((current) => current ? { ...current, submissions: current.submissions.map((item) => item.id === saved.id ? saved : item) } : current);
      setForms((items) => items.map((form) => form.id === detail?.id ? { ...form, _count: { submissions: Math.max(0, form._count.submissions - 1) } } : form));
      flash("Registrant marked as un-registered");
    } catch (error: any) { flash(error.message); }
  };
  const copyLink = async (form: RegistrationForm) => { const url = `${window.location.origin}/registration/${form.slug}`; try { await navigator.clipboard.writeText(url); flash("Share link copied"); } catch { window.prompt("Copy this registration link", url); } };
  const initials = current?.user?.name?.split(" ").map((part: string) => part[0]).slice(0, 2).join("") || "LN";
  const activeSubmissions = detail?.submissions.filter((submission) => !submission.unregisteredAt) || [];
  const registeredPersons = activeSubmissions.reduce((total, submission) => total + submission.attendances.reduce((sum, attendance) => sum + Number(attendance.totalPersons || 0), 0), 0);
  const eventDateSummaries = detail?.eventDates.map((eventDate) => activeSubmissions.reduce((summary, submission) => {
    const attendance = submission.attendances.find((item) => item.eventDate.id === eventDate.id);
    if (!attendance) return summary;
    const persons = Number(attendance.totalPersons || 0);
    return { ...summary, registered: summary.registered + persons, meals: summary.meals + (attendance.meal ? persons : 0) };
  }, { eventDate, registered: 0, meals: 0 })) || [];
  return <div className="dash registrationAdmin">
    <aside><Link to="/" className="brand light"><span>LN</span><div>LOCAL NEWS<small>NEWSROOM OS</small></div></Link><div className="workspace"><small>WORKSPACE</small><b>{current?.user?.name}</b></div><button onClick={() => nav("/newsroom")}><LayoutDashboard />Overview</button><button><FileText />Stories</button><button><Users />People</button><button className="active"><ClipboardList />Registration</button><button><Settings />Settings</button><div className="profile"><div>{initials}</div><span><b>{current?.user?.name}</b><small>{current?.user?.role}</small></span></div></aside>
    <section className="content registrationContent"><div className="top"><div><small>ADMINISTRATION / REGISTRATION · 管理 / 登记</small><h1>Registration forms / 登记表格</h1><p>Create event forms, share public links and review pre-registrations. / 建立活动表格、分享公开链接并查看预登记。</p></div><button className="new" onClick={() => open()}><Plus />New form / 新建表格</button></div>
      {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      <div className="registrationSummary"><div><b>{forms.length}</b><span>Forms / 表格</span></div><div><b>{forms.filter((form) => form.active).length}</b><span>Open / 开放</span></div><div><b>{forms.reduce((sum, form) => sum + form._count.submissions, 0)}</b><span>Registrations / 登记</span></div></div>
      <div className="registrationGrid">{loading && <div className="registrationEmpty">Loading registration forms…</div>}{!loading && !forms.length && <div className="registrationEmpty"><ClipboardList /><h2>No registration forms yet</h2><p>Create the first form to receive outsider pre-registrations.</p><button className="new" onClick={() => open()}><Plus />New form</button></div>}{forms.map((form) => <article className="registrationCard" key={form.id}><div className="registrationCardHead"><span className={form.active ? "open" : "closed"}>{form.active ? "Open" : "Closed"}</span><small>{form._count.submissions} registrations</small></div><h2>{form.eventName}</h2><p>{form.description}</p><div className="registrationDates">{form.eventDates.map((item) => <span key={item.id}><CalendarDays />{new Date(item.eventDate).toLocaleDateString()}</span>)}</div><small>Created by {form.creator.name}</small><div className="registrationCardActions"><button onClick={() => showResponses(form)} title="View registrations"><Eye /></button><button onClick={() => copyLink(form)} title="Copy public link"><Copy /></button><button onClick={() => open(form)} title="Edit form"><Pencil /></button><button className="danger" onClick={() => remove(form)} title="Delete form"><Trash2 /></button></div></article>)}</div>
    </section>
    {editor && <div className="modalBackdrop" onMouseDown={() => setEditor(null)}><form className="registrationEditor" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="modalHead"><div><small>{editor.id ? "EDIT FORM" : "NEW FORM"}</small><h2>{editor.id ? "Edit registration form" : "Create registration form"}</h2></div><button type="button" onClick={() => setEditor(null)}><X /></button></div>
      <section className="registrationPhotoEditor">
        <div className={editor.photoDataUrl || (editor.photoUrl && !editor.removePhoto) ? "hasPhoto" : ""} style={editor.photoDataUrl || (editor.photoUrl && !editor.removePhoto) ? { backgroundImage: `url(${editor.photoDataUrl || editor.photoUrl})` } : undefined}><ImagePlus /></div>
        <span><b>Form photo / 表格照片</b><small>PNG, JPEG or WebP · maximum 5 MB</small><label><ImagePlus />{editor.photoUrl || editor.photoDataUrl ? "Replace photo / 更换照片" : "Upload photo / 上传照片"}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectPhoto(event.target.files?.[0])} /></label>{(editor.photoUrl || editor.photoDataUrl) && !editor.removePhoto && <button type="button" onClick={() => setEditor({ ...editor, photoDataUrl: "", removePhoto: true })}><Trash2 />Remove photo / 移除照片</button>}</span>
      </section>
      <label>Event name<input required minLength={2} maxLength={160} value={editor.eventName} onChange={(event) => setEditor({ ...editor, eventName: event.target.value })} /></label>
      <label>Description<textarea required minLength={2} maxLength={5000} rows={5} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} /></label>
      <fieldset><legend>Event dates</legend>{editor.eventDates.map((value: string, index: number) => <div className="registrationDateInput" key={index}><input type="date" required value={value} onChange={(event) => setEditor({ ...editor, eventDates: editor.eventDates.map((item: string, itemIndex: number) => itemIndex === index ? event.target.value : item) })} /><button type="button" disabled={editor.eventDates.length === 1} onClick={() => setEditor({ ...editor, eventDates: editor.eventDates.filter((_: string, itemIndex: number) => itemIndex !== index) })}><Trash2 /></button></div>)}<button className="addDate" type="button" onClick={() => setEditor({ ...editor, eventDates: [...editor.eventDates, ""] })}><Plus />Add another date</button></fieldset>
      <label className="registrationSwitch"><input type="checkbox" checked={editor.active} onChange={(event) => setEditor({ ...editor, active: event.target.checked })} /><span />Public form is open</label>
      <div className="modalActions"><button type="button" onClick={() => setEditor(null)}>Cancel</button><button className="new" type="submit">{editor.id ? "Save changes" : "Create form"}</button></div>
    </form></div>}
    {detail && <div className="modalBackdrop" onMouseDown={() => setDetail(null)}>
      <section className="registrationResponses" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modalHead"><div><small>REGISTRATIONS / 登记名单</small><h2>{detail.eventName}</h2></div><button onClick={() => setDetail(null)}><X /></button></div>
        <div className="responseTotal"><span>Total persons registered / 已登记总人数</span><strong>{registeredPersons}</strong></div>
        <section className="responseDateSummaries" aria-label="Registration summary by event date">
          {eventDateSummaries.map((summary) => <article key={summary.eventDate.id}><strong>{new Date(summary.eventDate.eventDate).toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</strong><div><span>Total Registered / 登记总人数<b>{summary.registered}</b></span><span>Total require Meal / 需要用餐总人数<b>{summary.meals}</b></span></div></article>)}
        </section>
        {!detail.submissions.length && <div className="registrationEmpty">No pre-registrations received yet. / 暂无预登记。</div>}
        <div className="responseList">{detail.submissions.map((submission) => <article className={submission.unregisteredAt ? "unregistered" : ""} key={submission.id}>
          <header><div><b>{submission.registrantName}</b><small>{submission.identity === "VOLUNTEER" ? "Volunteer / 志工" : "Non-Volunteer / 非志工"} · {submission.origin}</small></div><div className="responseRegistrationStatus"><span>{submission.unregisteredAt ? "Un-registered / 已取消登记" : "Registered / 已登记"}</span><time>{new Date(submission.createdAt).toLocaleString()}</time></div></header>
          <p>{submission.contact}</p>
          <div className="responseAttendances">{submission.attendances.map((attendance) => <div key={attendance.id}><strong>{new Date(attendance.eventDate.eventDate).toLocaleDateString()}</strong><label>Persons / 人数<input disabled={Boolean(submission.unregisteredAt)} type="number" min={1} max={999} value={attendance.totalPersons} onChange={(event) => editAttendance(submission.id, attendance.id, { totalPersons: Number(event.target.value) })} /></label><label>Meal / 用餐<select disabled={Boolean(submission.unregisteredAt)} value={attendance.meal ? "yes" : "no"} onChange={(event) => editAttendance(submission.id, attendance.id, { meal: event.target.value === "yes" })}><option value="no">No / 否</option><option value="yes">Yes / 是</option></select></label></div>)}</div>
          {submission.unregisteredAt ? <small className="unregisteredDate">Un-registered {new Date(submission.unregisteredAt).toLocaleString()}</small> : <div className="responseActions"><button type="button" onClick={() => updateSubmission(submission)}>Save changes / 保存更改</button><button type="button" className="danger" onClick={() => unregister(submission)}><Trash2 />Un-register / 取消登记</button></div>}
        </article>)}</div>
      </section>
    </div>}
  </div>;
}
