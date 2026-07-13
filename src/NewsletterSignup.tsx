import { FormEvent, useState } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

type SignupForm = {
  name: string;
  email: string;
  stayArea: string;
  password: string;
};

const emptyForm: SignupForm = { name: "", email: "", stayArea: "", password: "" };
const isSignedIn = () => {
  try {
    const session = JSON.parse(localStorage.getItem("ln_session") || "null");
    return Boolean(session?.token && session?.user);
  } catch {
    return false;
  }
};

export default function NewsletterSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signedIn = isSignedIn();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Sign up failed");
      localStorage.setItem("ln_session", JSON.stringify(data));
      navigate("/newsroom/stories");
    } catch (signupError: any) {
      setError(signupError.message);
    } finally {
      setBusy(false);
    }
  };

  if (signedIn) return null;

  return <section className="newsletter signupNewsletter">
    <span>STAY INFORMED</span>
    <h2>Join us with your HearT</h2>
    <p>Create your DaDe reader account and follow every published story.</p>
    {error && <div className="signupError" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <label>Full name<input required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label>
      <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
      <label>Stay area<input required minLength={2} maxLength={120} autoComplete="address-level2" value={form.stayArea} onChange={event => setForm({ ...form, stayArea: event.target.value })} placeholder="City or area" /></label>
      <label>Password<input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="At least 8 characters" /></label>
      <button type="submit" disabled={busy}>{busy ? "Signing up…" : "Sign Up"}{busy ? <CheckCircle2 /> : <ArrowUpRight />}</button>
    </form>
    <small>Every new account is registered as DaDe.</small>
  </section>;
}
