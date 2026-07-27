import { CalendarCheck2, CalendarDays, CheckCircle2, Clock3, Mail, MapPin, Phone, RefreshCw, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AudienceSidebar } from "./Audience";
import DoctorPageShell from "./DoctorPageShell";

type Appointment = {
  id: string;
  patientName: string;
  patientPhone?: string | null;
  startTime: string;
  endTime: string;
  reason?: string | null;
  status: string;
  patient: { id: string; name: string; email: string; phone?: string | null; avatarUrl?: string | null };
  event: { id: string; name: string; eventDate: string; location: string };
};

const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [completing, setCompleting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/doctor/health/appointments", {
        headers: { Authorization: `Bearer ${session()?.token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not load appointments");
      setAppointments(result);
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentCount = useMemo(
    () => appointments.filter((item) => ["PENDING", "CONFIRMED"].includes(item.status)).length,
    [appointments],
  );

  const completeAppointment = async () => {
    if (!selected) return;
    try {
      setCompleting(true);
      setError("");
      const response = await fetch(`/api/doctor/health/appointments/${selected.id}/complete`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session()?.token}` },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not complete appointment");
      setAppointments((items) => items.map((item) => item.id === result.id ? result : item));
      setSelected(result);
      setNotice(`Appointment with ${result.patientName} marked as completed.`);
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <DoctorPageShell>
      <div className="dash audienceDash doctorSettings doctorAppointments">
      <AudienceSidebar active="appointments" />
      <section className="content">
        <div className="top">
          <div>
            <small>DOCTOR / APPOINTMENTS</small>
            <h1>My appointments</h1>
            <p>Appointments booked with you across your assigned health events.</p>
          </div>
          <button className="doctorRefresh" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "spinning" : ""} />
            Refresh
          </button>
        </div>

        <div className="doctorAppointmentSummary">
          <span>
            <CalendarCheck2 />
            <b>{currentCount}</b>
            <small>Current appointments</small>
          </span>
          <span>
            <UserRound />
            <b>{new Set(appointments.map((item) => item.patient.id)).size}</b>
            <small>Patients</small>
          </span>
        </div>

        {notice && <div className="doctorSlotNotice success"><CheckCircle2 />{notice}<button onClick={() => setNotice("")}><X /></button></div>}
        {error && <div className="doctorSlotNotice error">{error}<button onClick={() => setError("")}><X /></button></div>}
        {loading ? (
          <div className="panel doctorAppointmentEmpty">Loading appointments…</div>
        ) : !appointments.length ? (
          <div className="panel doctorAppointmentEmpty">
            <CalendarCheck2 />
            <h2>No appointments yet</h2>
            <p>New bookings with you will appear here.</p>
          </div>
        ) : (
          <div className="doctorAppointmentList">
            {appointments.map((appointment) => (
              <article className="panel doctorAppointmentCard" key={appointment.id} role="button" tabIndex={0} onClick={() => setSelected(appointment)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(appointment); }}>
                <div className="doctorAppointmentDate">
                  <CalendarDays />
                  <span>
                    <small>{dateLabel(appointment.event.eventDate)}</small>
                    <b>{appointment.startTime}–{appointment.endTime}</b>
                  </span>
                </div>
                <div className="doctorAppointmentPatient">
                  <span className={`doctorPatientAvatar${appointment.patient.avatarUrl ? " hasPhoto" : ""}`}>
                    {appointment.patient.avatarUrl ? <img src={appointment.patient.avatarUrl} alt={`${appointment.patientName} profile`} /> : appointment.patientName
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <h2>{appointment.patientName}</h2>
                    <p>{appointment.patient.email}</p>
                    {appointment.patientPhone && <p>{appointment.patientPhone}</p>}
                  </div>
                </div>
                <div className="doctorAppointmentDetails">
                  <b>{appointment.event.name}</b>
                  <span><MapPin />{appointment.event.location}</span>
                  <span><Clock3 />{appointment.startTime}–{appointment.endTime}</span>
                  {appointment.reason && <p>{appointment.reason}</p>}
                </div>
                <span className={`doctorAppointmentStatus ${appointment.status.toLowerCase()}`}>
                  {appointment.status.replaceAll("_", " ")}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
      {selected && (
        <div className="modalBackdrop doctorAppointmentModalBackdrop" onMouseDown={() => setSelected(null)}>
          <section className="panel doctorAppointmentModal" role="dialog" aria-modal="true" aria-labelledby="doctor-appointment-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="doctorAppointmentModalHead">
              <div>
                <small>APPOINTMENT DETAILS</small>
                <h2 id="doctor-appointment-title">{selected.patientName}</h2>
              </div>
              <button type="button" aria-label="Close appointment details" onClick={() => setSelected(null)}><X /></button>
            </div>
            <div className="doctorAppointmentModalBody">
              <div className={`doctorAppointmentPatientPhoto${selected.patient.avatarUrl ? " hasPhoto" : ""}`}>
                {selected.patient.avatarUrl ? <img src={selected.patient.avatarUrl} alt={`${selected.patientName} full profile`} /> : <span>{selected.patientName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>}
              </div>
              <div className="doctorAppointmentModalDate">
                <CalendarDays />
                <span><small>{dateLabel(selected.event.eventDate)}</small><b>{selected.startTime}–{selected.endTime}</b></span>
              </div>
              <div className="doctorAppointmentModalSection">
                <small>PATIENT</small>
                <h3>{selected.patientName}</h3>
                <p><Mail />{selected.patient.email}</p>
                {(selected.patientPhone || selected.patient.phone) && <p><Phone />{selected.patientPhone || selected.patient.phone}</p>}
              </div>
              <div className="doctorAppointmentModalSection">
                <small>HEALTH EVENT</small>
                <h3>{selected.event.name}</h3>
                <p><MapPin />{selected.event.location}</p>
              </div>
              {selected.reason && <div className="doctorAppointmentModalReason"><small>REASON / NOTES</small><p>{selected.reason}</p></div>}
            </div>
            <div className="doctorAppointmentModalActions">
              <span className={`doctorAppointmentStatus ${selected.status.toLowerCase()}`}>{selected.status.replaceAll("_", " ")}</span>
              <button type="button" onClick={() => setSelected(null)}>Close</button>
              {["PENDING", "CONFIRMED"].includes(selected.status) && <button type="button" className="doctorCompleteButton" disabled={completing} onClick={completeAppointment}><CheckCircle2 />{completing ? "Completing…" : "Mark completed"}</button>}
            </div>
          </section>
        </div>
      )}
      </div>
    </DoctorPageShell>
  );
}
