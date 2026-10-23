import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CarFront,
  CheckCircle2,
  Copy,
  Pencil,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useAuthorities } from "./menuAccess";
import { whatsappParkingPassUrl } from "./whatsappInvite";
import "./parking-pass.css";
import "./parking-pass-public.css";

type ParkingPass = {
  id: string;
  publicToken: string;
  visitorName: string;
  mobileNumber: string;
  carPlateNumber: string;
  eventName: string;
  eventDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  issuedBy: { id: string; name: string };
};

type ParkingPassEditor = {
  id?: string;
  visitorName: string;
  mobileNumber: string;
  carPlateNumber: string;
  eventName: string;
  eventDate: string;
  active: boolean;
};

const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const dateInputValue = (value = new Date().toISOString()) => value.slice(0, 10);
const emptyEditor = (): ParkingPassEditor => ({
  visitorName: "",
  mobileNumber: "",
  carPlateNumber: "",
  eventName: "",
  eventDate: dateInputValue(),
  active: true,
});
const passUrl = (pass: ParkingPass) =>
  `${window.location.origin}/parking-pass/${encodeURIComponent(pass.publicToken)}`;

export default function ParkingPassManagement() {
  const allowed = useAuthorities("parking_passes");
  const [passes, setPasses] = useState<ParkingPass[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ParkingPassEditor | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session()?.token || ""}`,
  };
  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const load = async () => {
    setLoading(true);
    try {
      setPasses(await api("/api/admin/parking-passes"));
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return passes;
    return passes.filter((pass) =>
      `${pass.visitorName} ${pass.mobileNumber} ${pass.carPlateNumber} ${pass.eventName} ${pass.issuedBy.name}`
        .toLowerCase()
        .includes(needle),
    );
  }, [passes, query]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const result = await api(
        editing.id ? `/api/admin/parking-passes/${editing.id}` : "/api/admin/parking-passes",
        {
          method: editing.id ? "PATCH" : "POST",
          body: JSON.stringify(editing),
        },
      );
      setPasses((current) =>
        editing.id
          ? current.map((pass) => (pass.id === result.id ? result : pass))
          : [result, ...current],
      );
      setEditing(null);
      flash(editing.id ? "Parking pass updated" : "Parking pass issued");
    } catch (error: any) {
      flash(error.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (pass: ParkingPass) => {
    if (!confirm(`Delete the parking pass for ${pass.visitorName}? The shared link will stop working.`)) return;
    try {
      await api(`/api/admin/parking-passes/${pass.id}`, { method: "DELETE" });
      setPasses((current) => current.filter((item) => item.id !== pass.id));
      flash("Parking pass deleted");
    } catch (error: any) {
      flash(error.message);
    }
  };
  const share = (pass: ParkingPass) => {
    const url = whatsappParkingPassUrl({
      phone: pass.mobileNumber,
      visitorName: pass.visitorName,
      carPlateNumber: pass.carPlateNumber,
      shareUrl: passUrl(pass),
    });
    if (!url) return flash("Enter a valid visitor mobile number before sharing");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="dash parkingPassManagement">
      <aside><Link to="/" className="brand light"><span>LN</span><div>LOCAL NEWS<small>NEWSROOM OS</small></div></Link></aside>
      <section className="content parkingPassPage">
        <div className="top">
          <div><small>ADMINISTRATION / PARKING PASS</small><h1>Parking Pass</h1><p>Issue and manage electronic parking passes for visitors.</p></div>
          {allowed("new") && <button className="new" onClick={() => setEditing(emptyEditor())}><Plus />Issue parking pass</button>}
        </div>
        {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}><X /></button></div>}
        <div className="parkingPassSummary">
          <div><CarFront /><span><b>{passes.length}</b><small>Total passes</small></span></div>
          <div><CheckCircle2 /><span><b>{passes.filter((pass) => pass.active).length}</b><small>Active passes</small></span></div>
        </div>
        <div className="panel parkingPassPanel">
          <div className="parkingPassTools">
            <label><Search /><input aria-label="Search parking passes" placeholder="Search visitor, mobile or car plate" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <span>{filtered.length} passes</span>
          </div>
          {loading ? <div className="emptyState">Loading parking passes…</div> : filtered.length ? (
            <div className="parkingPassTable">
              <div className="parkingPassRow parkingPassHeader"><span>Visitor</span><span>Vehicle</span><span>Event</span><span>Status</span><span>Actions</span></div>
              {filtered.map((pass) => (
                <div className="parkingPassRow" key={pass.id}>
                  <div><b>{pass.visitorName}</b><small>{pass.mobileNumber}</small></div>
                  <strong>{pass.carPlateNumber}</strong>
                  <div><b>{pass.eventName}</b><time>{new Date(pass.eventDate).toLocaleDateString()}</time></div>
                  <span className={pass.active ? "parkingPassStatus active" : "parkingPassStatus revoked"}>{pass.active ? "Active" : "Revoked"}</span>
                  <div className="parkingPassActions">
                    <a href={passUrl(pass)} target="_blank" rel="noreferrer" title="View electronic pass"><ShieldCheck /></a>
                    {allowed("copy_link") && <button title="Share by WhatsApp" onClick={() => share(pass)}><Share2 /></button>}
                    {allowed("new") && <button title="Clone parking pass" onClick={() => setEditing({ visitorName: pass.visitorName, mobileNumber: pass.mobileNumber, carPlateNumber: pass.carPlateNumber, eventName: pass.eventName, eventDate: dateInputValue(pass.eventDate), active: true })}><Copy /></button>}
                    {allowed("edit") && <button title="Edit parking pass" onClick={() => setEditing({ id: pass.id, visitorName: pass.visitorName, mobileNumber: pass.mobileNumber, carPlateNumber: pass.carPlateNumber, eventName: pass.eventName, eventDate: dateInputValue(pass.eventDate), active: pass.active })}><Pencil /></button>}
                    {allowed("delete") && <button className="danger" title="Delete parking pass" onClick={() => remove(pass)}><Trash2 /></button>}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="emptyState">No parking passes found.</div>}
        </div>
      </section>
      {editing && (
        <div className="modalBackdrop" onMouseDown={() => setEditing(null)}>
          <form className="userModal parkingPassModal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modalHead"><div><small>{editing.id ? "EDIT PARKING PASS" : "NEW PARKING PASS"}</small><h2>{editing.id ? "Update visitor pass" : "Issue electronic pass"}</h2></div><button type="button" aria-label="Close" onClick={() => setEditing(null)}><X /></button></div>
            <label>Visitor name<input autoFocus required minLength={2} maxLength={100} value={editing.visitorName} onChange={(event) => setEditing({ ...editing, visitorName: event.target.value })} /></label>
            <label>Mobile number<input required inputMode="tel" minLength={7} maxLength={30} placeholder="e.g. 012-345 6789" value={editing.mobileNumber} onChange={(event) => setEditing({ ...editing, mobileNumber: event.target.value })} /></label>
            <label>Car plate number<input required minLength={2} maxLength={20} autoCapitalize="characters" placeholder="e.g. VAA 1234" value={editing.carPlateNumber} onChange={(event) => setEditing({ ...editing, carPlateNumber: event.target.value.toUpperCase() })} /></label>
            <label>Event name<input required minLength={2} maxLength={150} value={editing.eventName} onChange={(event) => setEditing({ ...editing, eventName: event.target.value })} /></label>
            <label>Event date<input required type="date" value={editing.eventDate} onChange={(event) => setEditing({ ...editing, eventDate: event.target.value })} /></label>
            {editing.id && <label className="parkingPassActive"><input type="checkbox" checked={editing.active} onChange={(event) => setEditing({ ...editing, active: event.target.checked })} />Pass is active</label>}
            <div className="modalActions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="new" disabled={saving}>{saving ? "Saving…" : editing.id ? "Save changes" : "Issue pass"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

export function PublicParkingPass() {
  const { token = "" } = useParams();
  const [pass, setPass] = useState<ParkingPass | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/parking-passes/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Parking pass not found");
        setPass(data);
      })
      .catch((reason) => setError(reason.message));
  }, [token]);
  return (
    <main className="publicParkingPassPage">
      {error ? <section className="publicParkingPassCard invalid"><XCircle /><h1>Parking pass unavailable</h1><p>{error}</p></section> : !pass ? <section className="publicParkingPassCard"><p>Loading electronic pass…</p></section> : (
        <section className={`publicParkingPassCard${pass.active ? "" : " invalid"}`}>
          <div className="publicParkingMeta">
            <strong>#{pass.publicToken.slice(0, 8).toUpperCase()}</strong>
            <time>{new Date(pass.eventDate).toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })}</time>
          </div>
          <header>
            <h1>停车证</h1>
            <div className="publicParkingCars"><CarFront /><CarFront /></div>
            <h2>PARKING PASS</h2>
          </header>
          <div className="publicParkingPlate">{pass.carPlateNumber}</div>
          <div className="publicParkingVisitor">
            <small>VISITOR / 访客</small>
            <strong>{pass.visitorName}</strong>
            <span>{pass.mobileNumber}</span>
          </div>
          <div className="publicParkingEvent">{pass.eventName}</div>
          <div className="publicParkingStatus">{pass.active ? <><CheckCircle2 />VALID PARKING PASS</> : <><XCircle />PARKING PASS REVOKED</>}</div>
        </section>
      )}
    </main>
  );
}
