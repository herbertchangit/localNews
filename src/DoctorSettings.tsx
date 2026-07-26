import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CalendarHeart,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  booked: boolean;
};
type HealthEvent = {
  id: string;
  name: string;
  location: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  active: boolean;
  timeSlots: Slot[];
};
type DoctorProfile = {
  id: string;
  specialization: string;
  qualification: string;
  user: { name: string; email: string; avatarUrl?: string | null };
};
type SettingsData = { profile: DoctorProfile; events: HealthEvent[] };

const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function DoctorSettings() {
  const nav = useNavigate();
  const user = session()?.user;
  const [data, setData] = useState<SettingsData | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [form, setForm] = useState({
    startTime: "09:00",
    endTime: "17:00",
    slotDurationMinutes: 15,
  });
  const [editing, setEditing] = useState<Slot | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const api = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(`/api/doctor/health${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session()?.token}`,
        ...options.headers,
      },
    });
    const result =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(result?.error || "Could not complete the request");
    return result;
  };

  const load = async (preferredEventId?: string) => {
    try {
      setError("");
      const result: SettingsData = await api("/settings");
      setData(result);
      const nextId =
        preferredEventId &&
        result.events.some((item) => item.id === preferredEventId)
          ? preferredEventId
          : selectedEventId &&
              result.events.some((item) => item.id === selectedEventId)
            ? selectedEventId
            : result.events[0]?.id || "";
      setSelectedEventId(nextId);
      const event = result.events.find((item) => item.id === nextId);
      if (event)
        setForm((current) => ({
          ...current,
          startTime: event.startTime,
          endTime: event.endTime,
        }));
    } catch (caught: any) {
      setError(caught.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedEvent = useMemo(
    () => data?.events.find((item) => item.id === selectedEventId) || null,
    [data, selectedEventId],
  );
  const allSlots = data?.events.flatMap((item) => item.timeSlots) || [];
  const initials =
    user?.name
      ?.split(" ")
      .map((part: string) => part[0])
      .slice(0, 2)
      .join("") || "DR";

  const chooseEvent = (event: HealthEvent) => {
    setSelectedEventId(event.id);
    setForm((current) => ({
      ...current,
      startTime: event.startTime,
      endTime: event.endTime,
    }));
    setEditing(null);
    setNotice("");
    setError("");
  };

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedEvent) return;
    try {
      setBusy(true);
      setError("");
      setNotice("");
      const result = await api("/slots/bulk", {
        method: "POST",
        body: JSON.stringify({ eventId: selectedEvent.id, ...form }),
      });
      setNotice(
        `${result.created} appointment slot${result.created === 1 ? "" : "s"} created${result.skipped ? `; ${result.skipped} overlapping slot${result.skipped === 1 ? "" : "s"} skipped` : ""}.`,
      );
      await load(selectedEvent.id);
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const update = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !selectedEvent) return;
    try {
      setBusy(true);
      setError("");
      await api(`/slots/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          startTime: editing.startTime,
          endTime: editing.endTime,
        }),
      });
      setEditing(null);
      setNotice("Appointment slot updated.");
      await load(selectedEvent.id);
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (slot: Slot) => {
    if (!confirm(`Delete the ${slot.startTime}–${slot.endTime} slot?`)) return;
    try {
      setBusy(true);
      setError("");
      await api(`/slots/${slot.id}`, { method: "DELETE" });
      setNotice("Appointment slot deleted.");
      await load(selectedEventId);
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dash audienceDash doctorSettings">
      <aside>
        <Link to="/newsroom" className="brand light">
          <span>LN</span>
          <div>
            LOCAL NEWS<small>DOCTOR DESK</small>
          </div>
        </Link>
        <div className="workspace">
          <small>Talk With Doc</small>
          <b>Doctor Portal</b>
        </div>
        <button onClick={() => nav("/newsroom")}>
          <LayoutDashboard />
          Overview
        </button>
        <button onClick={() => nav("/newsroom/health-services")}>
          <CalendarHeart />
          Talk With Doc
        </button>
        <button className="active">
          <Settings />
          Settings
        </button>
        <div className="profile">
          <div>{initials}</div>
          <span>
            <b>{user?.name}</b>
            <small>Doctor</small>
          </span>
        </div>
      </aside>

      <section className="content">
        <div className="top">
          <div>
            <small>DOCTOR / SETTINGS</small>
            <h1>Appointment slots</h1>
            <p>Create and manage your availability for assigned health events.</p>
          </div>
          <button className="doctorRefresh" onClick={() => load(selectedEventId)}>
            <RefreshCw />
            Refresh
          </button>
        </div>

        {notice && (
          <div className="doctorSlotNotice success">
            <CheckCircle2 />
            {notice}
            <button onClick={() => setNotice("")}>
              <X />
            </button>
          </div>
        )}
        {error && (
          <div className="doctorSlotNotice error">
            {error}
            <button onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}

        {data && (
          <>
            <div className="doctorIdentity panel">
              <div className="doctorIdentityIcon">
                <Stethoscope />
              </div>
              <div>
                <small>DOCTOR PROFILE</small>
                <h2>{data.profile.user.name}</h2>
                <p>
                  {data.profile.specialization} · {data.profile.qualification}
                </p>
              </div>
              <div className="doctorSlotSummary">
                <span>
                  <b>{data.events.length}</b>
                  <small>Assigned events</small>
                </span>
                <span>
                  <b>{allSlots.filter((slot) => !slot.booked).length}</b>
                  <small>Available slots</small>
                </span>
                <span>
                  <b>{allSlots.filter((slot) => slot.booked).length}</b>
                  <small>Booked slots</small>
                </span>
              </div>
            </div>

            {!data.events.length ? (
              <div className="panel doctorNoEvents">
                <CalendarDays />
                <h2>No assigned events</h2>
                <p>An administrator must assign you to a health event before you can create appointment slots.</p>
              </div>
            ) : (
              <>
                <div className="doctorEventPicker">
                  <h2>Select event</h2>
                  <div>
                    {data.events.map((event) => (
                      <button
                        className={event.id === selectedEventId ? "active" : ""}
                        key={event.id}
                        onClick={() => chooseEvent(event)}
                      >
                        <CalendarDays />
                        <span>
                          <b>{event.name}</b>
                          <small>
                            {dateLabel(event.eventDate)} · {event.startTime}–
                            {event.endTime}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedEvent && (
                  <div className="doctorSlotGrid">
                    <form className="panel doctorSlotGenerator" onSubmit={generate}>
                      <div className="doctorSectionHead">
                        <span>
                          <Plus />
                        </span>
                        <div>
                          <h2>Generate appointment slots</h2>
                          <p>
                            Create consecutive slots during {selectedEvent.name}.
                          </p>
                        </div>
                      </div>
                      <label>
                        Start time
                        <input
                          required
                          type="time"
                          min={selectedEvent.startTime}
                          max={selectedEvent.endTime}
                          value={form.startTime}
                          onChange={(event) =>
                            setForm({ ...form, startTime: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        End time
                        <input
                          required
                          type="time"
                          min={selectedEvent.startTime}
                          max={selectedEvent.endTime}
                          value={form.endTime}
                          onChange={(event) =>
                            setForm({ ...form, endTime: event.target.value })
                          }
                        />
                      </label>
                      <label className="wide">
                        Slot duration
                        <select
                          value={form.slotDurationMinutes}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              slotDurationMinutes: Number(event.target.value),
                            })
                          }
                        >
                          {[10, 15, 20, 30, 45, 60].map((minutes) => (
                            <option value={minutes} key={minutes}>
                              {minutes} minutes
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="doctorGenerateButton" disabled={busy}>
                        <Clock3 />
                        {busy ? "Generating…" : "Generate slots"}
                      </button>
                    </form>

                    <div className="panel doctorSlotList">
                      <div className="doctorSectionHead">
                        <span>
                          <Clock3 />
                        </span>
                        <div>
                          <h2>Your slots</h2>
                          <p>
                            {selectedEvent.timeSlots.length} appointment slot
                            {selectedEvent.timeSlots.length === 1 ? "" : "s"} for{" "}
                            {selectedEvent.name}
                          </p>
                        </div>
                      </div>
                      {!selectedEvent.timeSlots.length ? (
                        <div className="doctorSlotsEmpty">
                          <Clock3 />
                          <p>No appointment slots created yet.</p>
                        </div>
                      ) : (
                        <div className="doctorSlots">
                          {selectedEvent.timeSlots.map((slot) => (
                            <div
                              className={`doctorSlot${slot.booked ? " booked" : ""}`}
                              key={slot.id}
                            >
                              <span>
                                <b>
                                  {slot.startTime}–{slot.endTime}
                                </b>
                                <small>{slot.slotDurationMinutes} minutes</small>
                              </span>
                              <i>{slot.booked ? "Booked" : "Available"}</i>
                              <div>
                                <button
                                  type="button"
                                  title="Edit appointment slot"
                                  disabled={slot.booked}
                                  onClick={() => setEditing({ ...slot })}
                                >
                                  <Pencil />
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  title="Delete appointment slot"
                                  disabled={slot.booked || busy}
                                  onClick={() => remove(slot)}
                                >
                                  <Trash2 />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {editing && selectedEvent && (
        <div
          className="healthModalBackdrop modalBackdrop"
          onMouseDown={() => setEditing(null)}
        >
          <form
            className="userModal healthModal doctorSlotEditor"
            onSubmit={update}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="healthModalHead">
              <div>
                <small>EDIT APPOINTMENT SLOT</small>
                <h2>{selectedEvent.name}</h2>
              </div>
              <button type="button" onClick={() => setEditing(null)}>
                <X />
              </button>
            </div>
            <div className="doctorSlotEditFields">
              <label>
                Start time
                <input
                  required
                  type="time"
                  min={selectedEvent.startTime}
                  max={selectedEvent.endTime}
                  value={editing.startTime}
                  onChange={(event) =>
                    setEditing({ ...editing, startTime: event.target.value })
                  }
                />
              </label>
              <label>
                End time
                <input
                  required
                  type="time"
                  min={selectedEvent.startTime}
                  max={selectedEvent.endTime}
                  value={editing.endTime}
                  onChange={(event) =>
                    setEditing({ ...editing, endTime: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="healthFormActions">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="new" disabled={busy}>
                {busy ? "Saving…" : "Save slot"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
