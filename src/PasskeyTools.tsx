import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { KeyRound, ScanFace, ShieldCheck, Trash2 } from "lucide-react";

type Passkey = { id: string; name: string; createdAt: string; lastUsedAt?: string | null };
const session = () => { try { return JSON.parse(localStorage.getItem("ln_session") || "null"); } catch { return null; } };
const supported = () => window.isSecureContext && typeof window.PublicKeyCredential !== "undefined";
const messageFor = (error: any, fallback: string) => error?.name === "NotAllowedError" ? "Face or device verification was cancelled." : error?.message || fallback;

export function PasskeyLoginButton({ onAuthenticated, onError }: { onAuthenticated: (result: any) => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const available = supported();
  const login = async () => {
    setBusy(true); onError("");
    try {
      const optionsResponse = await fetch("/api/passkeys/authenticate/options", { method: "POST" });
      const setup = await optionsResponse.json();
      if (!optionsResponse.ok) throw new Error(setup.error || "Could not start face login");
      const response = await startAuthentication({ optionsJSON: setup.options });
      const verificationResponse = await fetch("/api/passkeys/authenticate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: setup.challengeId, response }) });
      const result = await verificationResponse.json();
      if (!verificationResponse.ok) throw new Error(result.error || "Face login failed");
      onAuthenticated(result);
    } catch (error: any) { onError(messageFor(error, "Face login failed")); }
    finally { setBusy(false); }
  };
  return <><div className="passkeyDivider"><span>or</span></div><button className="passkeyLoginButton" type="button" disabled={busy || !available} onClick={login}><ScanFace />{!available ? "Face login unavailable" : busy ? "Verifying…" : "Sign in with Face / Passkey"}</button><small className="passkeyLoginHint">{available ? "Uses your device’s Face Unlock, fingerprint, or screen lock." : "Open this page in a supported browser over HTTPS to use Face Login."}</small></>;
}

function PasskeySettingsCard() {
  const [items, setItems] = useState<Passkey[]>([]), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const token = session()?.token;
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers } });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const load = () => api("/api/passkeys").then(setItems).catch((error) => setNotice(error.message));
  useEffect(() => { load(); }, []);
  const enroll = async () => {
    setBusy(true); setNotice("");
    try {
      const setup = await api("/api/passkeys/register/options", { method: "POST" });
      const response = await startRegistration({ optionsJSON: setup.options });
      const created = await api("/api/passkeys/register/verify", { method: "POST", body: JSON.stringify({ challengeId: setup.challengeId, response, name: "Face login / Device passkey" }) });
      setItems((current) => [created, ...current]); setNotice("Face login is ready on this device.");
    } catch (error: any) { setNotice(messageFor(error, "Could not enable face login")); }
    finally { setBusy(false); }
  };
  const remove = async (item: Passkey) => {
    if (!confirm(`Remove ${item.name}? Password login will still work.`)) return;
    setBusy(true);
    try { await api(`/api/passkeys/${item.id}`, { method: "DELETE" }); setItems((current) => current.filter((existing) => existing.id !== item.id)); setNotice("Face login removed from your account."); }
    catch (error: any) { setNotice(error.message); }
    finally { setBusy(false); }
  };
  return <section className="panel settingsCard passkeySettingsCard"><div className="settingsHead"><span><ScanFace /></span><div><h2>Face login</h2><p>Use your phone’s secure biometric verification to sign in.</p></div></div>{!supported() ? <div className="passkeyUnavailable"><KeyRound />Face login needs a supported browser and secure HTTPS connection.</div> : <><div className="passkeySecurityNote"><ShieldCheck /><span><b>Your face stays on your device.</b>Local News stores only a secure public passkey.</span></div><button className="new passkeyEnrollButton" type="button" disabled={busy} onClick={enroll}><ScanFace />{busy ? "Waiting for device…" : "Enable Face Login"}</button></>}<div className="passkeyList">{items.map((item) => <div key={item.id}><KeyRound /><span><b>{item.name}</b><small>Added {new Date(item.createdAt).toLocaleDateString()}{item.lastUsedAt ? ` · Last used ${new Date(item.lastUsedAt).toLocaleDateString()}` : ""}</small></span><button type="button" disabled={busy} onClick={() => remove(item)} aria-label={`Remove ${item.name}`}><Trash2 /></button></div>)}</div>{notice && <p className="passkeyNotice" role="status">{notice}</p>}</section>;
}

export function PasskeySettingsTools() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let mount: HTMLElement | null = null;
    const attach = () => {
      if (mount) return;
      const grid = document.querySelector<HTMLElement>(".readerSettingsGrid"), doctorContent = document.querySelector<HTMLElement>(".doctorSettings .content"), target = grid || doctorContent;
      if (!target) return;
      mount = document.createElement("div"); mount.className = grid ? "passkeySettingsMount" : "passkeyDoctorSettingsMount";
      if (grid) grid.prepend(mount); else doctorContent?.querySelector(".top")?.after(mount);
      setHost(mount); observer.disconnect();
    };
    const observer = new MutationObserver(attach); observer.observe(document.body, { childList: true, subtree: true }); attach();
    return () => { observer.disconnect(); mount?.remove(); };
  }, []);
  return host ? createPortal(<PasskeySettingsCard />, host) : null;
}
