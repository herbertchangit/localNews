import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, Lock, Mail, MapPinned, Phone, UserRound } from "lucide-react";

type Area = { id: string; name: string; mutualLove?: { name: string } };
type Props = { onCancel: () => void; onRegistered: (session: any) => void };

export default function SignUpForm({ onCancel, onRegistered }: Props) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [form, setForm] = useState({ name: "", email: "", contact: "", stayArea: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/public/areas").then((response) => response.ok ? response.json() : []).then(setAreas).catch(() => setAreas([]));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) return setError("Passwords do not match");
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not create account");
      onRegistered(result);
    } catch (reason: any) { setError(reason.message); }
    finally { setBusy(false); }
  };

  return <form className="signupForm" onSubmit={submit}>
    <div className="loginTitle"><small>NEW READER ACCOUNT</small><h2>Create your account</h2><p>Sign up to access stories, registrations and Talk With Doc services.</p></div>
    {error && <div className="loginError">{error}</div>}
    <label>Full name<div className="loginInput"><UserRound /><input autoFocus required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" /></div></label>
    <label>Email address <small>(optional)</small><div className="loginInput"><Mail /><input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" placeholder="A system email will be generated if blank" /></div></label>
    <label>Contact number<div className="loginInput"><Phone /><input required type="tel" minLength={7} maxLength={40} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} autoComplete="tel" /></div></label>
    <label>Stay area<div className="loginInput"><MapPinned /><select required value={form.stayArea} onChange={(event) => setForm({ ...form, stayArea: event.target.value })}><option value="">Select area</option>{areas.map((area) => <option key={area.id} value={area.name}>{area.name}{area.mutualLove?.name ? ` : ${area.mutualLove.name}` : ""}</option>)}</select></div></label>
    <div className="signupPasswordGrid"><label>Password<div className="loginInput"><Lock /><input required minLength={8} maxLength={72} type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /></div></label><label>Confirm password<div className="loginInput"><Lock /><input required minLength={8} maxLength={72} type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} autoComplete="new-password" /></div></label></div>
    <label className="signupShowPassword"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />{showPassword ? <EyeOff /> : <Eye />} Show password</label>
    <button className="loginSubmit" disabled={busy}>{busy ? "Creating account…" : "Sign up"}<ArrowUpRight /></button>
    <button className="signupBack" type="button" onClick={onCancel}><ArrowLeft />Back to sign in</button>
  </form>;
}
