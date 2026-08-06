import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import PublicHeader from "./PublicHeader";

type EventDate = { id: string; eventDate: string };
type Form = { id: string; eventName: string; description: string; photoUrl: string | null; slug: string; eventDates: EventDate[] };
type Attendance = { selected: boolean; totalPersons: number; meal: boolean };

const AREAS = [
  "Bandar Bukit Puchong 1",
  "Bandar Bukit Puchong 2",
  "Bandar Puteri",
  "Bandar Kinrara",
  "Puchong Indah",
  "Puchong Intan",
  "Puchong Jaya",
  "Puchong Perdana",
  "Puchong Prima",
  "Puchong Utama",
  "Puchong Wawasan",
  "Pusat Bandar Puchong",
  "Saujana Puchong",
  "Taman Kinrara",
];

export default function PublicRegistration() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [passwordChangeToken, setPasswordChangeToken] = useState(""), [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({ newPassword: "", confirmPassword: "" });
  const [values, setValues] = useState({ registrantName: "", identity: "NON_VOLUNTEER", contact: "", area: "", otherArea: "" });
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});

  useEffect(() => {
    fetch(`/api/registrations/public/${encodeURIComponent(slug || "")}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setForm(data);
        setAttendance(Object.fromEntries(data.eventDates.map((item: EventDate) => [item.id, { selected: false, totalPersons: 1, meal: false }])));
      })
      .catch((reason) => setError(reason.message || "Registration form unavailable"))
      .finally(() => setLoading(false));
  }, [slug]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const attendances = Object.entries(attendance).filter(([, value]) => value.selected).map(([eventDateId, value]) => ({ eventDateId, totalPersons: value.totalPersons, meal: value.meal }));
    if (!attendances.length) return setError("Select at least one event date / 请至少选择一个活动日期");
    const origin = values.area === "OTHERS" ? values.otherArea.trim() : values.area;
    if (!origin) return setError("Select or enter your area / 请选择或填写地区");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/registrations/public/${encodeURIComponent(slug || "")}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrantName: values.registrantName, identity: values.identity, contact: values.contact, origin, attendances }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit registration");
      setDone(true);
      setAccountCreated(Boolean(result.accountCreated));
      if (result.accountCreated && result.passwordChangeToken) {
        setPasswordChangeToken(result.passwordChangeToken);
        window.setTimeout(() => setShowPassword(true), 180000);
      }
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/change-default-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passwordChangeToken, ...passwords }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create password");
      localStorage.setItem("ln_session", JSON.stringify(result));
      navigate("/newsroom/appointments", { replace: true });
    } catch (reason: any) { setError(reason.message); }
    finally { setBusy(false); }
  };

  return <div className="publicRegistrationPage">
    <PublicHeader hideLoginWhenSignedOut />
    {loading && <main className="publicRegistrationCard">Loading registration form… / 正在载入登记表格…</main>}
    {!loading && error && !form && <main className="publicRegistrationCard"><h1>Registration unavailable / 登记表格暂不可用</h1><p>{error}</p><Link to="/">Return to Local News / 返回本地新闻</Link></main>}
    {form && done && !showPassword && <main className="publicRegistrationCard registrationThanks"><CheckCircle2 /><small>PRE-REGISTRATION RECEIVED / 已收到预登记</small><h1>Thank you / 谢谢您，{values.registrantName}.</h1><p>Your registration for / 您的登记已记录：<b>{form.eventName}</b></p>{accountCreated?<><p>A new DADE account has been created. Create your password to view the registered event date in Your Appointments.<br/>已为您建立慈济人账户。请设置新密码，然后在“您的预约”查看登记日期。</p><p className="registrationRedirectNotice">Password setup will open in 3 minutes, or continue when you are ready.<br/>密码设置将在三分钟后打开，您也可以准备好后立即继续。</p><button className="publicRegistrationSubmit registrationContinueButton" type="button" onClick={()=>setShowPassword(true)}>Create password now / 立即设置密码</button></>:<p>Sign in with your contact number to view the registered event date in Your Appointments.<br/>请使用联络号码登录，并在“您的预约”查看登记日期。</p>}{!accountCreated&&<Link to="/login" state={{from:"/newsroom/appointments"}}>Sign in / 登录</Link>}</main>}
    {form && done && showPassword && <main className="publicRegistrationCard registrationPasswordCard"><small>CREATE YOUR PASSWORD / 设置新密码</small><h1>Activate your DADE account / 启用您的慈济人账户</h1><p>After saving, Your Appointments will open automatically.<br/>保存后将自动打开“您的预约”。</p>{error&&<div className="registrationError">{error}</div>}<form onSubmit={savePassword}><label>New password / 新密码<input autoFocus required minLength={8} maxLength={72} type="password" value={passwords.newPassword} onChange={event=>setPasswords({...passwords,newPassword:event.target.value})}/></label><label>Confirm password / 确认密码<input required minLength={8} maxLength={72} type="password" value={passwords.confirmPassword} onChange={event=>setPasswords({...passwords,confirmPassword:event.target.value})}/></label><button className="publicRegistrationSubmit" disabled={busy}>{busy?"Saving… / 正在保存…":"Save password and view appointments / 保存并查看预约"}</button></form></main>}
    {form && !done && <main className="publicRegistrationCard">
      {form.photoUrl && <img className="publicRegistrationPhoto" src={form.photoUrl} alt={`${form.eventName} event`} />}
      <small>EVENT PRE-REGISTRATION FORM / 活动预登记表格</small>
      <h1>{form.eventName}</h1>
      <p className="registrationDescription">{form.description}</p>
      {error && <div className="registrationError">{error}</div>}
      <form onSubmit={submit}>
        <label>Registrant name / 登记人姓名<input required minLength={2} maxLength={120} value={values.registrantName} onChange={(event) => setValues({ ...values, registrantName: event.target.value })} /></label>
        <fieldset className="identityOptions"><legend>Identity / 身份</legend><label><input type="radio" name="identity" value="NON_VOLUNTEER" checked={values.identity === "NON_VOLUNTEER"} onChange={() => setValues({ ...values, identity: "NON_VOLUNTEER" })} />Non-Volunteer / 非志工</label><label><input type="radio" name="identity" value="VOLUNTEER" checked={values.identity === "VOLUNTEER"} onChange={() => setValues({ ...values, identity: "VOLUNTEER" })} />Volunteer / 志工</label></fieldset>
        <label>Contact / 联络号码<input required minLength={5} maxLength={80} type="tel" value={values.contact} onChange={(event) => setValues({ ...values, contact: event.target.value })} /></label>
        <label>From / 来自地区<select required value={values.area} onChange={(event) => setValues({ ...values, area: event.target.value, otherArea: event.target.value === "OTHERS" ? values.otherArea : "" })}><option value="">Select area / 选择地区</option>{AREAS.map((area) => <option key={area} value={area}>{area}</option>)}<option value="OTHERS">Others / 其他地区</option></select></label>
        {values.area === "OTHERS" && <label>Other area / 其他地区<input autoFocus required minLength={2} maxLength={160} value={values.otherArea} onChange={(event) => setValues({ ...values, otherArea: event.target.value })} /></label>}
        <fieldset><legend>Select event date(s) / 选择活动日期</legend>{form.eventDates.map((item) => {
          const value = attendance[item.id];
          return <div className={`publicDateChoice ${value?.selected ? "selected" : ""}`} key={item.id}>
            <label className="dateSelect"><input type="checkbox" checked={value?.selected || false} onChange={(event) => setAttendance({ ...attendance, [item.id]: { ...value, selected: event.target.checked } })} /><CalendarDays /><b>{new Date(item.eventDate).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</b></label>
            {value?.selected && <div className="dateDetails"><label>Total persons / 总人数<input required type="number" min={1} max={999} value={value.totalPersons} onChange={(event) => setAttendance({ ...attendance, [item.id]: { ...value, totalPersons: Number(event.target.value) } })} /></label><label>Meal / 用餐<select value={value.meal ? "yes" : "no"} onChange={(event) => setAttendance({ ...attendance, [item.id]: { ...value, meal: event.target.value === "yes" } })}><option value="no">No / 否</option><option value="yes">Yes / 是</option></select></label></div>}
          </div>;
        })}</fieldset>
        <button className="publicRegistrationSubmit" disabled={busy}>{busy ? "Submitting… / 正在提交…" : "Submit pre-registration / 提交预登记"}</button>
      </form>
    </main>}
  </div>;
}
