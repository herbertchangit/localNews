import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Phone, Save } from "lucide-react";
import "./contact-settings.css";

const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${session()?.token}` });

function ContactField() {
  const [profile, setProfile] = useState<any>(null);
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, { ...options, headers: { ...headers(), ...options.headers } });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  useEffect(() => {
    api("/api/me/reader-account").then((user) => { setProfile(user); setContact(user.phone || ""); }).catch((error) => setNotice(error.message));
  }, []);
  const save = async () => {
    if (!profile || busy) return;
    setBusy(true); setNotice("");
    try {
      const user = await api("/api/me/reader-account/contact", {
        method: "PATCH",
        body: JSON.stringify({ contact }),
      });
      setProfile((current: any) => ({ ...current, phone: user.phone })); setContact(user.phone || ""); setNotice("Contact saved");
      window.setTimeout(() => setNotice(""), 2800);
    } catch (error: any) { setNotice(error.message); }
    finally { setBusy(false); }
  };
  return <label className="readerContactField">Contact<div><Phone/><input type="tel" inputMode="tel" minLength={7} maxLength={40} value={contact} onChange={(event) => setContact(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); save(); } }} placeholder="Phone or contact number"/><button type="button" disabled={!profile || busy} onClick={save} aria-label="Save contact">{notice === "Contact saved" ? <Check/> : <Save/>}</button></div>{notice && <small className={notice === "Contact saved" ? "saved" : "error"}>{notice}</small>}</label>;
}

export default function ContactSettingsTools() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let mount: HTMLElement | null = null;
    const attach = () => {
      if (mount) return;
      const fields = document.querySelector<HTMLElement>(".readerBasic");
      if (!fields) return;
      mount = document.createElement("div"); mount.className = "readerContactMount"; fields.append(mount); setHost(mount); observer.disconnect();
    };
    const observer = new MutationObserver(attach); observer.observe(document.body, { childList: true, subtree: true }); attach();
    return () => { observer.disconnect(); mount?.remove(); };
  }, []);
  return host ? createPortal(<ContactField/>, host) : null;
}
