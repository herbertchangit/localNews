import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import PublicHeader from "./PublicHeader";
import { registrationPrefill } from "./registrationPrefill";
import { isRegistrationQuantityAnswer, type RegistrationQuantityAnswer } from "./registrationAnswers";

type EventDate = { id: string; eventDate: string };
type CustomField = { id: string; title: string; type: "TEXT" | "TEXTAREA" | "NUMBER" | "DATE" | "SELECT" | "RADIO" | "CHECKBOX" | "RADIO_QUANTITY" | "CHECKBOX_QUANTITY"; required: boolean; options: string[] };
type Form = { id: string; eventName: string; description: string; photoUrl: string | null; slug: string; fromEventDate: string | null; toEventDate: string | null; eventType: "APPOINTMENT" | "ORDER"; eventDates: EventDate[]; customFields: CustomField[] };
type AreaOption = { id: string; name: string; mutualLove: { id: string; name: string; harmony: { id: string; name: string } } };
type Session = { token: string; user: { name?: string; role?: string } };

const readSession = (): Session | null => {
  try { return JSON.parse(localStorage.getItem("ln_session") || "null"); }
  catch { return null; }
};

export default function PublicRegistration() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get("invite")?.trim() || "";
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [passwordChangeToken, setPasswordChangeToken] = useState(""), [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({ newPassword: "", confirmPassword: "" });
  const [values, setValues] = useState({ registrantName: "", identity: "NON_VOLUNTEER", contact: "", area: "", otherArea: "" });
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string | number | string[] | RegistrationQuantityAnswer>>({});

  useEffect(() => {
    if (invitationToken) return;
    const session = readSession();
    if (!session?.token || !session.user) return;

    const initial = registrationPrefill(session.user);
    setValues((current) => ({ ...current, ...initial }));
    fetch("/api/me/reader-account", { headers: { Authorization: `Bearer ${session.token}` } })
      .then(async (response) => {
        const profile = await response.json().catch(() => null);
        if (!response.ok) throw new Error(profile?.error || "Could not load account details");
        const accountDefaults = registrationPrefill(session.user, profile.phone, profile.stayArea);
        setValues((current) => ({ ...current, contact: current.contact || accountDefaults.contact, area: current.area || accountDefaults.area }));
      })
      .catch(() => undefined);
  }, [invitationToken]);

  useEffect(() => {
    if (!slug || !invitationToken) return;
    fetch(`/api/registrations/public/${encodeURIComponent(slug)}/invitations/${encodeURIComponent(invitationToken)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Could not load invitation details");
        setValues((current) => ({ ...current, ...data }));
      })
      .catch((reason) => setError(reason.message || "This invitation link is invalid or unavailable"));
  }, [slug, invitationToken]);

  useEffect(() => {
    fetch("/api/public/areas")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Could not load areas");
        setAreas(data);
      })
      .catch(() => setAreas([]));
  }, []);

  useEffect(() => {
    fetch(`/api/registrations/public/${encodeURIComponent(slug || "")}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setForm(data);
      })
      .catch((reason) => setError(reason.message || "Registration form unavailable"))
      .finally(() => setLoading(false));
  }, [slug]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const attendances: never[] = [];
    const origin = values.area === "OTHERS" ? values.otherArea.trim() : values.area;
    if (!origin) return setError("Select or enter your area / 请选择或填写地区");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/registrations/public/${encodeURIComponent(slug || "")}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrantName: values.registrantName, identity: values.identity, contact: values.contact, origin, attendances, customAnswers }),
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

  const renderCustomField = (field: CustomField) => {
    const answer = customAnswers[field.id];
    const setAnswer = (value: string | number | string[] | RegistrationQuantityAnswer) => setCustomAnswers((current) => ({ ...current, [field.id]: value }));
    if (field.type === "RADIO") return <section className="publicCustomField" key={field.id}><fieldset><legend>{field.title}{field.required ? " *" : ""}</legend>{field.options.map((option) => <label key={option}><input required={field.required} type="radio" name={field.id} value={option} checked={answer === option} onChange={() => setAnswer(option)} />{option}</label>)}</fieldset></section>;
    if (field.type === "CHECKBOX") {
      const selected = Array.isArray(answer) ? answer : [];
      return <section className="publicCustomField" key={field.id}><fieldset><legend>{field.title}{field.required ? " *" : ""}</legend>{field.options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => setAnswer(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} />{option}</label>)}{field.required && <input className="customCheckboxRequirement" required tabIndex={-1} aria-hidden="true" value={selected.length ? "selected" : ""} onChange={() => undefined} />}</fieldset></section>;
    }
    if (["RADIO_QUANTITY", "CHECKBOX_QUANTITY"].includes(field.type)) {
      const quantities = isRegistrationQuantityAnswer(answer) ? answer : {};
      const multiple = field.type === "CHECKBOX_QUANTITY";
      const selectOption = (option: string, checked: boolean) => {
        if (!checked) {
          const next = { ...quantities };
          delete next[option];
          return setAnswer(next);
        }
        setAnswer(multiple ? { ...quantities, [option]: quantities[option] || 1 } : { [option]: quantities[option] || 1 });
      };
      return <section className="publicCustomField publicQuantityField" key={field.id}><fieldset><legend>{field.title}{field.required ? " *" : ""}</legend>{field.options.map((option) => { const selected = Number(quantities[option] || 0) > 0; return <div className="publicQuantityOption" key={option}><label><input required={!multiple && field.required} type={multiple ? "checkbox" : "radio"} name={field.id} checked={selected} onChange={(event) => selectOption(option, event.target.checked)} />{option}</label><label className="publicQuantityInput">Quantity / 数量<input aria-label={`${option} quantity`} disabled={!selected} required={selected} type="number" min={1} max={999} value={selected ? quantities[option] : ""} onChange={(event) => setAnswer({ ...quantities, [option]: Math.max(1, Math.min(999, Number(event.target.value) || 1)) })} /></label></div>; })}{multiple && field.required && <input className="customCheckboxRequirement" required tabIndex={-1} aria-hidden="true" value={Object.values(quantities).some((quantity) => Number(quantity) > 0) ? "selected" : ""} onChange={() => undefined} />}</fieldset></section>;
    }
    return <section className="publicCustomField" key={field.id}><label>{field.title}{field.type === "TEXT" && <input required={field.required} maxLength={5000} value={String(answer ?? "")} onChange={(event) => setAnswer(event.target.value)} />}{field.type === "TEXTAREA" && <textarea required={field.required} maxLength={5000} rows={4} value={String(answer ?? "")} onChange={(event) => setAnswer(event.target.value)} />}{field.type === "NUMBER" && <input required={field.required} type="number" value={answer ?? ""} onChange={(event) => setAnswer(event.target.value === "" ? "" : Number(event.target.value))} />}{field.type === "DATE" && <input required={field.required} type="date" value={String(answer ?? "")} onChange={(event) => setAnswer(event.target.value)} />}{field.type === "SELECT" && <select required={field.required} value={String(answer ?? "")} onChange={(event) => setAnswer(event.target.value)}><option value="">Select an option</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>}</label></section>;
  };

  return <div className="publicRegistrationPage">
    <PublicHeader hideLoginWhenSignedOut />
    {loading && <main className="publicRegistrationCard">Loading registration form… / 正在载入登记表格…</main>}
    {!loading && error && !form && <main className="publicRegistrationCard"><h1>Registration unavailable / 登记表格暂不可用</h1><p>{error}</p><Link to="/">Return to Local News / 返回本地新闻</Link></main>}
    {form && done && !showPassword && <main className="publicRegistrationCard registrationThanks"><CheckCircle2 /><small>PRE-REGISTRATION RECEIVED / 已收到预登记</small><h1>Thank you / 谢谢您，{values.registrantName}.</h1><p>Your registration for / 您的登记已记录：<b>{form.eventName}</b></p>{accountCreated?<><p>A new DADE account has been created. Create your password to access your account.<br/>已为您建立慈济人账户。请设置新密码以使用您的账户。</p><p className="registrationRedirectNotice">Password setup will open in 3 minutes, or continue when you are ready.<br/>密码设置将在三分钟后打开，您也可以准备好后立即继续。</p><button className="publicRegistrationSubmit registrationContinueButton" type="button" onClick={()=>setShowPassword(true)}>Create password now / 立即设置密码</button></>:<p>Your registration has been received.<br/>您的登记已收到。</p>}{!accountCreated&&<Link to="/login">Sign in / 登录</Link>}</main>}
    {form && done && showPassword && <main className="publicRegistrationCard registrationPasswordCard"><small>CREATE YOUR PASSWORD / 设置新密码</small><h1>Activate your DADE account / 启用您的慈济人账户</h1><p>After saving, Your Appointments will open automatically.<br/>保存后将自动打开“您的预约”。</p>{error&&<div className="registrationError">{error}</div>}<form onSubmit={savePassword}><label>New password / 新密码<input autoFocus required minLength={8} maxLength={72} type="password" value={passwords.newPassword} onChange={event=>setPasswords({...passwords,newPassword:event.target.value})}/></label><label>Confirm password / 确认密码<input required minLength={8} maxLength={72} type="password" value={passwords.confirmPassword} onChange={event=>setPasswords({...passwords,confirmPassword:event.target.value})}/></label><button className="publicRegistrationSubmit" disabled={busy}>{busy?"Saving… / 正在保存…":"Save password and view appointments / 保存并查看预约"}</button></form></main>}
    {form && !done && <main className="publicRegistrationCard">
      {form.photoUrl && <img className="publicRegistrationPhoto" src={form.photoUrl} alt={`${form.eventName} event`} />}
      <small>{form.eventType === "ORDER" ? "EVENT ORDER FORM / 活动订购表格" : "EVENT PRE-REGISTRATION FORM / 活动预登记表格"}</small>
      <h1>{form.eventName}</h1>
      <p className="registrationDescription">{form.description}</p>
      {form.fromEventDate && form.toEventDate && (
        <p className="publicRegistrationEventRange">
          <b>Event date / 活动日期:</b>{" "}
          {new Date(form.fromEventDate).toLocaleDateString()}
          {form.toEventDate.slice(0, 10) !== form.fromEventDate.slice(0, 10) &&
            ` – ${new Date(form.toEventDate).toLocaleDateString()}`}
        </p>
      )}
      {error && <div className="registrationError">{error}</div>}
      <form onSubmit={submit}>
        <label>Registrant name / 登记人姓名<input required minLength={2} maxLength={120} value={values.registrantName} onChange={(event) => setValues({ ...values, registrantName: event.target.value })} /></label>
        <fieldset className="identityOptions"><legend>Identity / 身份</legend><label><input type="radio" name="identity" value="NON_VOLUNTEER" checked={values.identity === "NON_VOLUNTEER"} onChange={() => setValues({ ...values, identity: "NON_VOLUNTEER" })} />Non-Volunteer / 非志工</label><label><input type="radio" name="identity" value="VOLUNTEER" checked={values.identity === "VOLUNTEER"} onChange={() => setValues({ ...values, identity: "VOLUNTEER" })} />Volunteer / 志工</label></fieldset>
        <label>Contact / 联络号码<input required minLength={5} maxLength={80} type="tel" value={values.contact} onChange={(event) => setValues({ ...values, contact: event.target.value })} /></label>
        <label>From / 来自地区<select required value={values.area} onChange={(event) => setValues({ ...values, area: event.target.value, otherArea: event.target.value === "OTHERS" ? values.otherArea : "" })}><option value="">Select area / 选择地区</option>{values.area&&values.area!=="OTHERS"&&!areas.some(area=>area.name===values.area)&&<option value={values.area}>{values.area} (current)</option>}{areas.map((area) => <option key={area.id} value={area.name}>{area.name} : {area.mutualLove.name}</option>)}<option value="OTHERS">Others / 其他地区</option></select></label>
        {values.area === "OTHERS" && <label>Other area / 其他地区<input autoFocus required minLength={2} maxLength={160} value={values.otherArea} onChange={(event) => setValues({ ...values, otherArea: event.target.value })} /></label>}
        {form.customFields?.map(renderCustomField)}
        <button className="publicRegistrationSubmit" disabled={busy}>{busy ? "Submitting… / 正在提交…" : "Submit pre-registration / 提交预登记"}</button>
      </form>
    </main>}
  </div>;
}
