import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { IScannerControls } from "@zxing/browser";
import {
  ArrowUpRight,
  CalendarCheck2,
  CalendarHeart,
  CalendarX2,
  Camera,
  CircleCheckBig,
  ClipboardList,
  Clock,
  Eye,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Phone,
  RefreshCw,
  Save,
  ScanLine,
  Settings,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import RichText from "./RichText";
import HealthEventBoard from "./HealthEventBoard";
import DoctorPageShell from "./DoctorPageShell";
import {
  APP_UPDATE_RESULT_EVENT,
  CHECK_APP_UPDATE_EVENT,
  type AppUpdateResult,
} from "./pwaEvents";
import { firstHttpUrl, isVideoUrl, previewImageForUrl } from "./richTextUtils";
import { useMenuAccess } from "./menuAccess";
import ShareStoryButton from "./ShareStoryButton";
import { attendanceTokenFromQr } from "./attendanceQr";
type Story = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  slug: string;
  views: number;
  imageUrl?: string | null;
  photos?: { url: string }[];
  isHeadline?: boolean;
  storyDate?: string | null;
  publishedAt?: string;
  category: { name: string };
  author: { name: string };
};
type NewsCategory = { id: string; name: string; slug: string };
type Me = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};
type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  reason?: string | null;
  createdAt: string;
  registration?: {
    attendanceId: string;
    submissionId: string;
    totalPersons: number;
    meal: boolean;
    checkedInAt?: string | null;
  };
  event: { name: string; eventDate: string; location: string; address: string };
  doctor: {
    specialization: string;
    qualification: string;
    experienceYears: number;
    bio?: string | null;
    profileImage?: string | null;
    consultationFee: number;
    user: {
      name: string;
      email: string;
      phone?: string | null;
      avatarUrl?: string | null;
    };
  };
};
const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const token = () => session()?.token;
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token()}`,
});
type SidebarAccount = {
  organizationLevel?: string | null;
  harmonyGroup?: { name: string } | null;
  mutualLoveGroup?: { name: string } | null;
  cooperationUnit?: { name: string } | null;
};
export function AudienceSidebar({
  active,
}: {
  active: "overview" | "people" | "health" | "appointments" | "settings";
}) {
  const u = session()?.user;
  const visible = useMenuAccess();
  const isDoctor = u?.role === "DOCTOR";
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [account, setAccount] = useState<SidebarAccount | null>(null);
  const [canAccessRegistrations, setCanAccessRegistrations] = useState(false);
  const [updateResult, setUpdateResult] = useState<AppUpdateResult | null>(
    null,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!u) return;
    const url = isDoctor
      ? "/api/doctor/health/appointments"
      : "/api/health-events/appointments/mine";
    fetch(url, { headers: { Authorization: `Bearer ${token()}` } })
      .then((response) => (response.ok ? response.json() : []))
      .then((items) => setAppointmentCount(items.length))
      .catch(() => setAppointmentCount(0));
  }, [u?.id, isDoctor]);
  useEffect(() => {
    if (!u) return;
    fetch("/api/me", { headers: { Authorization: `Bearer ${token()}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then(setAccount)
      .catch(() => setAccount(null));
  }, [u?.id]);
  useEffect(() => {
    if (!u) return;
    fetch("/api/registrations/capability", {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((capability) =>
        setCanAccessRegistrations(Boolean(capability?.canAccess)),
      )
      .catch(() => setCanAccessRegistrations(false));
  }, [u?.id]);
  useEffect(() => {
    let clearResult = 0;
    const receiveResult = (event: Event) => {
      const detail = (event as CustomEvent<AppUpdateResult>).detail;
      setUpdateResult(detail);
      window.clearTimeout(clearResult);
      if (detail.status === "latest" || detail.status === "error")
        clearResult = window.setTimeout(() => setUpdateResult(null), 5000);
    };
    window.addEventListener(APP_UPDATE_RESULT_EVENT, receiveResult);
    return () => {
      window.clearTimeout(clearResult);
      window.removeEventListener(APP_UPDATE_RESULT_EVENT, receiveResult);
    };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);
  useEffect(() => {
    const openMenu = () => setMenuOpen(true);
    window.addEventListener("local-news:open-reader-menu", openMenu);
    return () =>
      window.removeEventListener("local-news:open-reader-menu", openMenu);
  }, []);
  const updating =
    updateResult?.status === "checking" || updateResult?.status === "updating";
  const updateLabel =
    updateResult?.status === "checking"
      ? "Checking…"
      : updateResult?.status === "updating"
        ? "Updating…"
        : updateResult?.status === "latest"
          ? "Up to date"
          : updateResult?.status === "error"
            ? "Try again"
            : "Update App";
  const roleLabel =
    u?.role === "DADE" || u?.role === "AUDIENCE"
      ? "DaDe"
      : (u?.role || "Reader")
          .replaceAll("_", " ")
          .toLowerCase()
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const logout = () => {
    localStorage.removeItem("ln_session");
    location.href = "/login";
  };
  return (
    <>
      <button
        className="audienceSidebarToggle"
        type="button"
        aria-label="Open side menu"
        aria-expanded={menuOpen}
        aria-controls="audience-side-menu"
        onClick={() => setMenuOpen(true)}
      >
        <Menu />
      </button>
      {menuOpen && (
        <button
          className="audienceSidebarBackdrop"
          type="button"
          aria-label="Close side menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        id="audience-side-menu"
        className={`audienceSidebar${menuOpen ? " open" : ""}`}
      >
        <Link
          to="/newsroom"
          className="brand light"
          onClick={() => setMenuOpen(false)}
        >
          <span>LN</span>
          <div>
            LOCAL NEWS<small>{isDoctor ? "DOCTOR DESK" : "READER DESK"}</small>
          </div>
        </Link>
        <div className="workspace audienceAccountWorkspace">
          <small>MY ACCOUNT</small>
          <b>{u?.name || "Audience Reader"}</b>
          <span>{roleLabel}</span>
        </div>
        {visible("overview") && <Link
          className={`audienceSidebarLink${active === "overview" ? " active" : ""}`}
          to="/newsroom"
          onClick={() => setMenuOpen(false)}
        >
          <LayoutDashboard />
          Overview
        </Link>}
        {visible("people") && account?.organizationLevel === "COOPERATION_LEADER" && (
          <Link
            className={`audienceSidebarLink${active === "people" ? " active" : ""}`}
            to="/newsroom/people"
            onClick={() => setMenuOpen(false)}
          >
            <Users />
            People
          </Link>
        )}
        {visible("registrations") && canAccessRegistrations && (
          <Link
            className="audienceSidebarLink"
            to="/newsroom/registrations"
            onClick={() => setMenuOpen(false)}
          >
            <ClipboardList />
            Registration
          </Link>
        )}
        {visible("talk_with_doc") && <Link
          className={`audienceSidebarLink${active === "health" ? " active" : ""}`}
          to="/newsroom/health-services"
          onClick={() => setMenuOpen(false)}
        >
          <CalendarHeart />
          Talk With Doc
        </Link>}
        {visible("appointments") && <Link
          className={`audienceSidebarLink${active === "appointments" ? " active" : ""}`}
          to={
            isDoctor
              ? "/newsroom/doctor/appointments"
              : "/newsroom/appointments"
          }
          onClick={() => setMenuOpen(false)}
        >
          <CalendarCheck2 />
          Appointments{appointmentCount > 0 && <em>{appointmentCount}</em>}
        </Link>}
        {visible("settings") && <Link
          className={`audienceSidebarLink${active === "settings" ? " active" : ""}`}
          to="/newsroom/settings"
          onClick={() => setMenuOpen(false)}
        >
          <Settings />
          Settings
        </Link>}
        {visible("logout") && <button className="audienceLogoutButton" onClick={logout}>
          <LogOut />
          Logout
        </button>}
        {visible("update_app") && <><button
          className="audienceUpdateButton"
          disabled={updating}
          onClick={() =>
            window.dispatchEvent(new Event(CHECK_APP_UPDATE_EVENT))
          }
        >
          <RefreshCw className={updating ? "spinning" : ""} />
          {updateLabel}
        </button>
        <small className="audienceAppVersion">Version {__APP_VERSION__}</small></>}
      </aside>
    </>
  );
}
export function AudienceDashboard() {
  const [stories, setStories] = useState<Story[]>([]),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    fetch("/api/articles", { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => r.json())
      .then(setStories)
      .finally(() => setBusy(false));
  }, []);
  return (
    <div className="dash audienceDash">
      <AudienceSidebar active="overview" />
      <section className="content">
        <div className="top audienceTop">
          <div>
            <small>OVERVIEW / DAILY BRIEF</small>
            <h1>Daily Brief</h1>
            <p>Published reporting from across the community.</p>
          </div>
        </div>
        <div className="audienceHero">
          <div>
            <span>YOUR DAILY READING</span>
            <h2>Stay close to the stories shaping your city.</h2>
            <p>
              Verified reporting, local context, and community voices—all in one
              place.
            </p>
          </div>
          <strong>
            {stories.length}
            <small>Published stories</small>
          </strong>
        </div>
        {busy ? (
          <div className="panel emptyState">Loading stories…</div>
        ) : (
          <div className="audienceStories">
            {stories.map((s, i) => {
              const photo = s.photos?.[0]?.url || s.imageUrl;
              return (
                <article
                  key={s.id}
                  className={s.isHeadline ? "headlineStory" : ""}
                >
                  <div
                    className={
                      "audienceThumb at" + i + (photo ? " hasImage" : "")
                    }
                    style={
                      photo ? { backgroundImage: `url(${photo})` } : undefined
                    }
                  >
                    <span>
                      {s.isHeadline ? "HEADLINE / 頭條" : s.category.name}
                    </span>
                  </div>
                  <div className="audienceStoryBody">
                    <small>
                      {s.category.name} ·{" "}
                      {new Date(
                        s.publishedAt || Date.now(),
                      ).toLocaleDateString()}
                    </small>
                    <h2>
                      <Link to={`/stories/${s.slug}`}>{s.title}</Link>
                    </h2>
                    <RichText
                      value={s.excerpt}
                      className="audienceRichSummary"
                    />
                    <Link
                      className="audienceReadStory"
                      to={`/stories/${s.slug}`}
                    >
                      Read Story <ArrowUpRight />
                    </Link>
                    <ShareStoryButton title={s.title} slug={s.slug} previewImage={photo} />
                    <div>
                      <span>By {s.author.name}</span>
                      <span>
                        <Eye />
                        {s.views.toLocaleString()}
                      </span>
                      <span>
                        <Clock />5 min
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
export function AudienceHealthServices() {
  const page = (
    <div className="dash audienceDash">
      <AudienceSidebar active="health" />
      <section className="content audienceHealthServicesPage">
        <div className="top">
          <div>
            <small>AUDIENCE / TALK WITH DOC</small>
            <h1>Talk With Doc</h1>
            <p>Browse published health events and make an appointment.</p>
          </div>
        </div>
        <HealthEventBoard vertical />
      </section>
    </div>
  );
  return session()?.user?.role === "DOCTOR" ? (
    <DoctorPageShell>{page}</DoctorPageShell>
  ) : (
    page
  );
}
export function AudienceAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(true);
  const [cancelling, setCancelling] = useState("");
  const [savingRegistration, setSavingRegistration] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<{
    kind: "ready" | "checking" | "success" | "error";
    message: string;
  }>({ kind: "ready", message: "Point the camera at an event attendance QR code." });
  const scannerVideo = useRef<HTMLVideoElement>(null);
  const scannerControls = useRef<IScannerControls | null>(null);
  const scanProcessing = useRef(false);
  useEffect(() => {
    fetch("/api/health-events/appointments/mine", {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!response.ok)
          throw new Error(data.error || "Could not load appointments");
        return data;
      })
      .then(setAppointments)
      .catch((error) => setNotice(error.message))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) =>
        event.key === "Escape" && setSelected(null),
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", close);
    };
  }, [selected]);
  const submitAttendanceToken = async (attendanceToken: string) => {
    if (scanProcessing.current) return;
    scanProcessing.current = true;
    setCameraActive(false);
    scannerControls.current?.stop();
    setScanStatus({ kind: "checking", message: "Checking your registration…" });
    try {
      const response = await fetch("/api/registrations/mine/check-in", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ token: attendanceToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Could not mark attendance");
      const checkedInAt = String(data.checkedInAt);
      const applyCheckIn = (item: Appointment) =>
        item.registration?.attendanceId === data.attendanceId
          ? {
              ...item,
              registration: { ...item.registration, checkedInAt },
            }
          : item;
      setAppointments((current) => current.map(applyCheckIn));
      setSelected((current) => (current ? applyCheckIn(current) : current));
      const message = data.alreadyCheckedIn
        ? `Attendance was already marked for ${data.eventName}.`
        : `Attendance marked for ${data.eventName}.`;
      setScanStatus({ kind: "success", message });
      setNotice(message);
    } catch (error: any) {
      setScanStatus({ kind: "error", message: error.message });
    } finally {
      scanProcessing.current = false;
    }
  };
  useEffect(() => {
    const attendanceToken = new URLSearchParams(window.location.search).get(
      "attendance",
    );
    if (!attendanceToken) return;
    setScannerOpen(true);
    setCameraActive(false);
    void submitAttendanceToken(attendanceToken);
    const url = new URL(window.location.href);
    url.searchParams.delete("attendance");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  useEffect(() => {
    if (!scannerOpen || !cameraActive || !scannerVideo.current) return;
    let disposed = false;
    const video = scannerVideo.current;
    import("@zxing/browser")
      .then(({ BrowserQRCodeReader }) => {
        if (disposed) return null;
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 250,
        });
        return reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        video,
        (result, _error, controls) => {
          if (!result || disposed || scanProcessing.current) return;
          const attendanceToken = attendanceTokenFromQr(
            result.getText(),
            window.location.origin,
          );
          if (!attendanceToken) {
            setScanStatus({
              kind: "error",
              message: "This is not a Local News attendance QR code.",
            });
            return;
          }
          controls.stop();
          void submitAttendanceToken(attendanceToken);
        },
        );
      })
      .then((controls) => {
        if (!controls) return;
        if (disposed) controls.stop();
        else scannerControls.current = controls;
      })
      .catch((error) => {
        if (disposed) return;
        setCameraActive(false);
        setScanStatus({
          kind: "error",
          message:
            error?.name === "NotAllowedError"
              ? "Camera permission is required to scan attendance QR codes."
              : "The camera could not be started on this device.",
        });
      });
    return () => {
      disposed = true;
      scannerControls.current?.stop();
      scannerControls.current = null;
    };
  }, [scannerOpen, cameraActive]);
  const openScanner = () => {
    setScannerOpen(true);
    setScanStatus({
      kind: "ready",
      message: "Point the camera at an event attendance QR code.",
    });
    setCameraActive(true);
  };
  const closeScanner = () => {
    setCameraActive(false);
    scannerControls.current?.stop();
    setScannerOpen(false);
  };
  const cancelAppointment = async (item: Appointment) => {
    if (
      !confirm(
        `Cancel your appointment with ${item.doctor.user.name} on ${new Date(item.event.eventDate).toLocaleDateString()} at ${item.startTime}?`,
      )
    )
      return;
    setCancelling(item.id);
    setNotice("");
    try {
      const response = await fetch(
        `/api/health-events/appointments/${item.id}/cancel`,
        { method: "PATCH", headers: authHeaders() },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Could not cancel appointment");
      setAppointments((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? { ...existing, status: "CANCELLED" }
            : existing,
        ),
      );
      setSelected((current) =>
        current?.id === item.id ? { ...current, status: "CANCELLED" } : current,
      );
      setNotice(
        "Appointment cancelled. The time slot is now available to other users.",
      );
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setCancelling("");
    }
  };
  const editRegistration = (
    itemId: string,
    changes: Partial<NonNullable<Appointment["registration"]>>,
  ) => {
    setAppointments((current) =>
      current.map((item) =>
        item.id === itemId && item.registration
          ? { ...item, registration: { ...item.registration, ...changes } }
          : item,
      ),
    );
    setSelected((current) =>
      current?.id === itemId && current.registration
        ? { ...current, registration: { ...current.registration, ...changes } }
        : current,
    );
  };
  const saveRegistration = async (item: Appointment) => {
    if (!item.registration) return;
    setSavingRegistration(item.id);
    setNotice("");
    try {
      const response = await fetch(
        `/api/registrations/mine/${item.registration.attendanceId}`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            totalPersons: item.registration.totalPersons,
            meal: item.registration.meal,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Could not update registration");
      const changes = { totalPersons: data.totalPersons, meal: data.meal };
      editRegistration(item.id, changes);
      setAppointments((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? {
                ...existing,
                reason: `Total persons: ${changes.totalPersons} · Meal: ${changes.meal ? "Yes" : "No"}`,
              }
            : existing,
        ),
      );
      setNotice(
        "Registration appointment updated. Admin Registration has been synchronized.",
      );
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setSavingRegistration("");
    }
  };
  const unregisterRegistration = async (item: Appointment) => {
    if (
      !item.registration ||
      !confirm(
        `Un-register from ${item.event.name} on ${new Date(item.event.eventDate).toLocaleDateString()}?`,
      )
    )
      return;
    setSavingRegistration(item.id);
    setNotice("");
    try {
      const response = await fetch(
        `/api/registrations/mine/${item.registration.attendanceId}`,
        { method: "DELETE", headers: authHeaders() },
      );
      const data =
        response.status === 204
          ? null
          : await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data?.error || "Could not un-register appointment");
      setAppointments((current) =>
        current.filter((existing) => existing.id !== item.id),
      );
      setSelected((current) => (current?.id === item.id ? null : current));
      setNotice(
        "Registration appointment un-registered. Admin Registration has been synchronized.",
      );
    } catch (error: any) {
      setNotice(error.message);
    } finally {
      setSavingRegistration("");
    }
  };
  return (
    <div className="dash audienceDash">
      <AudienceSidebar active="appointments" />
      <section className="content audienceAppointmentsPage">
        <div className="top">
          <div>
            <small>AUDIENCE / TALK WITH DOC</small>
            <h1>Your appointments</h1>
            <p>
              Review your upcoming and previous health-service appointments.
            </p>
          </div>
          <button className="new appointmentScanButton" onClick={openScanner}>
            <ScanLine />
            Scan attendance QR
          </button>
        </div>
        {notice && (
          <div
            className={`doctorSlotNotice${/^(Appointment cancelled|Attendance|Registration appointment)/.test(notice) ? "" : " error"}`}
          >
            {notice}
          </div>
        )}
        {busy ? (
          <div className="panel emptyState">Loading appointments…</div>
        ) : appointments.length ? (
          <div className="audienceAppointmentList">
            {appointments.map((item) => {
              const doctorPhoto =
                item.doctor.profileImage || item.doctor.user.avatarUrl;
              return (
                <article
                  className={`panel audienceAppointmentCard${item.status === "CANCELLED" ? " isCancelled" : ""}`}
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View appointment with ${item.doctor.user.name}`}
                  onClick={() => setSelected(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(item);
                    }
                  }}
                >
                  <div className="audienceAppointmentDate">
                    <CalendarCheck2 />
                    <span>
                      <b>
                        {new Date(item.event.eventDate).toLocaleDateString(
                          undefined,
                          {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </b>
                      <small>
                        <Clock />
                        {item.startTime}–{item.endTime}
                      </small>
                    </span>
                  </div>
                  <div className="audienceAppointmentEvent">
                    <small>HEALTH EVENT</small>
                    <h2>{item.event.name}</h2>
                    <p>
                      <MapPin />
                      {item.event.location} · {item.event.address}
                    </p>
                  </div>
                  <div className="audienceAppointmentDoctor">
                    {doctorPhoto ? (
                      <img src={doctorPhoto} alt="" />
                    ) : (
                      <span className="audienceDoctorInitials">
                        {item.doctor.user.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                    )}
                    <span>
                      <b>{item.doctor.user.name}</b>
                      <small>{item.doctor.specialization}</small>
                    </span>
                  </div>
                  {item.registration && (
                    <div
                      className="audienceRegistrationEditor"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <label>
                        Persons / 人数
                        <input
                          aria-label="Total persons"
                          disabled={Boolean(item.registration.checkedInAt)}
                          type="number"
                          min={1}
                          max={999}
                          value={item.registration.totalPersons}
                          onChange={(event) =>
                            editRegistration(item.id, {
                              totalPersons: Math.max(
                                1,
                                Math.min(999, Number(event.target.value) || 1),
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        Meal / 用餐
                        <select
                          aria-label="Meal required"
                          disabled={Boolean(item.registration.checkedInAt)}
                          value={item.registration.meal ? "yes" : "no"}
                          onChange={(event) =>
                            editRegistration(item.id, {
                              meal: event.target.value === "yes",
                            })
                          }
                        >
                          <option value="no">No / 否</option>
                          <option value="yes">Yes / 是</option>
                        </select>
                      </label>
                      <div>
                        <button
                          type="button"
                          disabled={
                            savingRegistration === item.id ||
                            Boolean(item.registration.checkedInAt)
                          }
                          onClick={() => saveRegistration(item)}
                        >
                          <Save />
                          {savingRegistration === item.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          className="danger"
                          type="button"
                          disabled={
                            savingRegistration === item.id ||
                            Boolean(item.registration.checkedInAt)
                          }
                          onClick={() => unregisterRegistration(item)}
                        >
                          <CalendarX2 />
                          Un-register
                        </button>
                      </div>
                      {item.registration.checkedInAt && (
                        <span className="attendanceCheckedIn">
                          <CircleCheckBig />
                          Attended {new Date(item.registration.checkedInAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="audienceAppointmentControls">
                    <i className={`statusPill ${item.status.toLowerCase()}`}>
                      {item.status.replace("_", " ")}
                    </i>
                    {["PENDING", "CONFIRMED"].includes(item.status) && (
                      <button
                        className="audienceAppointmentCancel"
                        disabled={cancelling === item.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          cancelAppointment(item);
                        }}
                      >
                        <CalendarX2 />
                        {cancelling === item.id ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                  {item.reason && (
                    <p className="audienceAppointmentReason">
                      <b>Reason:</b> {item.reason}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="panel doctorNoEvents">
            <CalendarCheck2 />
            <h2>No appointments</h2>
            <p>Your booked health-service appointments will appear here.</p>
          </div>
        )}
      </section>
      {selected && (
        <div
          className="audienceAppointmentBackdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <section
            className="audienceAppointmentModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appointment-detail-title"
          >
            <header>
              <div>
                <small>APPOINTMENT DETAILS</small>
                <h2 id="appointment-detail-title">{selected.event.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Close appointment details"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </header>
            <div className="audienceAppointmentDoctorProfile">
              {selected.doctor.profileImage ||
              selected.doctor.user.avatarUrl ? (
                <img
                  src={
                    selected.doctor.profileImage ||
                    selected.doctor.user.avatarUrl ||
                    ""
                  }
                  alt={selected.doctor.user.name}
                />
              ) : (
                <span>
                  {selected.doctor.user.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
              )}
              <div>
                <small>YOUR DOCTOR</small>
                <h3>{selected.doctor.user.name}</h3>
                <b>{selected.doctor.specialization}</b>
                <p>
                  {selected.doctor.qualification} ·{" "}
                  {selected.doctor.experienceYears} years experience
                </p>
              </div>
            </div>
            <div className="audienceAppointmentDetailGrid">
              <div>
                <CalendarCheck2 />
                <span>
                  <small>DATE</small>
                  <b>
                    {new Date(selected.event.eventDate).toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      },
                    )}
                  </b>
                </span>
              </div>
              <div>
                <Clock />
                <span>
                  <small>TIME</small>
                  <b>
                    {selected.startTime}–{selected.endTime}
                  </b>
                </span>
              </div>
              <div>
                <MapPin />
                <span>
                  <small>LOCATION</small>
                  <b>{selected.event.location}</b>
                  <p>{selected.event.address}</p>
                </span>
              </div>
              <div>
                <ShieldCheck />
                <span>
                  <small>STATUS</small>
                  <b>{selected.status.replace("_", " ")}</b>
                </span>
              </div>
              {selected.doctor.user.email && (
                <div>
                  <Mail />
                  <span>
                    <small>DOCTOR EMAIL</small>
                    <b>{selected.doctor.user.email}</b>
                  </span>
                </div>
              )}
              {selected.doctor.user.phone && (
                <div>
                  <Phone />
                  <span>
                    <small>DOCTOR PHONE</small>
                    <b>{selected.doctor.user.phone}</b>
                  </span>
                </div>
              )}
            </div>
            {selected.doctor.bio && (
              <div className="audienceAppointmentDetailNote">
                <small>ABOUT THE DOCTOR</small>
                <p>{selected.doctor.bio}</p>
              </div>
            )}
            {selected.reason && (
              <div className="audienceAppointmentDetailNote">
                <small>REASON FOR APPOINTMENT</small>
                <p>{selected.reason}</p>
              </div>
            )}
            <footer className="audienceAppointmentActions">
              <button type="button" onClick={() => setSelected(null)}>
                Close
              </button>
              {["PENDING", "CONFIRMED"].includes(selected.status) && (
                <button
                  className="danger"
                  type="button"
                  disabled={cancelling === selected.id}
                  onClick={() => cancelAppointment(selected)}
                >
                  <CalendarX2 />
                  {cancelling === selected.id
                    ? "Cancelling…"
                    : "Cancel appointment"}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
      {scannerOpen && (
        <div className="attendanceScannerBackdrop" onMouseDown={(event) => event.target === event.currentTarget && closeScanner()}>
          <section className="attendanceScannerModal" role="dialog" aria-modal="true" aria-labelledby="attendance-scanner-title">
            <header>
              <div>
                <small>EVENT ATTENDANCE / 活动签到</small>
                <h2 id="attendance-scanner-title">Scan attendance QR</h2>
              </div>
              <button type="button" aria-label="Close scanner" onClick={closeScanner}><X /></button>
            </header>
            <div className="attendanceScannerCamera">
              <video ref={scannerVideo} muted playsInline />
              {cameraActive && <span><ScanLine /></span>}
              {!cameraActive && scanStatus.kind === "ready" && <Camera />}
            </div>
            <div className={`attendanceScannerStatus ${scanStatus.kind}`} role="status">
              {scanStatus.kind === "success" && <CircleCheckBig />}
              {scanStatus.kind === "ready" && <Camera />}
              <p>{scanStatus.message}</p>
            </div>
            <footer>
              {scanStatus.kind === "error" && (
                <button type="button" onClick={openScanner}><Camera />Try camera again</button>
              )}
              <button type="button" onClick={closeScanner}>Close</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
export function AudienceSettings() {
  const [me, setMe] = useState<Me | null>(null),
    [form, setForm] = useState({ name: "", email: "" }),
    [password, setPassword] = useState({
      currentPassword: "",
      newPassword: "",
    }),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(true);
  const api = async (url: string, opt: any = {}) => {
    const r = await fetch(url, { ...opt, headers: authHeaders() });
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  };
  useEffect(() => {
    api("/api/me")
      .then((x) => {
        setMe(x);
        setForm({ name: x.name, email: x.email });
      })
      .catch((e: any) => setNotice(e.message))
      .finally(() => setBusy(false));
  }, []);
  const flash = (s: string) => {
    setNotice(s);
    setTimeout(() => setNotice(""), 3000);
  };
  const save = async (e: any) => {
    e.preventDefault();
    try {
      const x = await api("/api/me", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setMe(x);
      const s = session();
      localStorage.setItem(
        "ln_session",
        JSON.stringify({
          ...s,
          user: { ...s.user, name: x.name, email: x.email },
        }),
      );
      flash("Profile updated successfully");
    } catch (e: any) {
      flash(e.message);
    }
  };
  const changePassword = async (e: any) => {
    e.preventDefault();
    try {
      await api("/api/me/password", {
        method: "POST",
        body: JSON.stringify(password),
      });
      setPassword({ currentPassword: "", newPassword: "" });
      flash("Password changed successfully");
    } catch (e: any) {
      flash(e.message);
    }
  };
  const remove = async () => {
    const pwd = prompt(
      "Enter your password to permanently delete your account.",
    );
    if (!pwd) return;
    if (!confirm("This will permanently delete your account. Continue?"))
      return;
    try {
      await api("/api/me", {
        method: "DELETE",
        body: JSON.stringify({ password: pwd }),
      });
      localStorage.removeItem("ln_session");
      location.href = "/";
    } catch (e: any) {
      flash(e.message);
    }
  };
  return (
    <div className="dash audienceDash">
      <AudienceSidebar active="settings" />
      <section className="content audienceSettings">
        <div className="top">
          <div>
            <small>AUDIENCE / SETTINGS</small>
            <h1>Account settings</h1>
            <p>View and manage your Local News account.</p>
          </div>
        </div>
        {notice && (
          <div className="toast">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        {busy ? (
          <div className="panel emptyState">Loading account…</div>
        ) : (
          <>
            <div className="settingsGrid">
              <form className="panel settingsCard" onSubmit={save}>
                <div className="settingsHead">
                  <span>
                    <UserRound />
                  </span>
                  <div>
                    <h2>Profile details</h2>
                    <p>Update your personal information.</p>
                  </div>
                </div>
                <label>
                  Full name
                  <div>
                    <UserRound />
                    <input
                      required
                      minLength={2}
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>
                </label>
                <label>
                  Email address
                  <div>
                    <Mail />
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                </label>
                <button className="new" type="submit">
                  <Save />
                  Save profile
                </button>
              </form>
              <form className="panel settingsCard" onSubmit={changePassword}>
                <div className="settingsHead">
                  <span>
                    <Lock />
                  </span>
                  <div>
                    <h2>Change password</h2>
                    <p>Keep your account protected.</p>
                  </div>
                </div>
                <label>
                  Current password
                  <div>
                    <Lock />
                    <input
                      required
                      type="password"
                      value={password.currentPassword}
                      onChange={(e) =>
                        setPassword({
                          ...password,
                          currentPassword: e.target.value,
                        })
                      }
                    />
                  </div>
                </label>
                <label>
                  New password
                  <div>
                    <ShieldCheck />
                    <input
                      required
                      minLength={8}
                      type="password"
                      value={password.newPassword}
                      onChange={(e) =>
                        setPassword({
                          ...password,
                          newPassword: e.target.value,
                        })
                      }
                    />
                  </div>
                </label>
                <button className="new" type="submit">
                  <Save />
                  Update password
                </button>
              </form>
            </div>
            <div className="panel accountInfo">
              <div>
                <b>Account role</b>
                <span>Audience</span>
              </div>
              <div>
                <b>Member since</b>
                <span>{new Date(me!.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <b>Last updated</b>
                <span>{new Date(me!.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="dangerZone">
              <div>
                <h2>Delete account</h2>
                <p>Permanently remove your profile and reading account.</p>
              </div>
              <button onClick={remove}>
                <Trash2 />
                Delete my account
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
export function AudienceHomepageDashboard() {
  const [stories, setStories] = useState<Story[]>([]),
    [categories, setCategories] = useState<NewsCategory[]>([]),
    [selectedCategory, setSelectedCategory] = useState<string | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/categories")
      .then(async (response) => {
        const data = await response.json().catch(() => []);
        if (!response.ok || !Array.isArray(data))
          throw new Error("Could not load news categories");
        setCategories(data);
      })
      .catch(() => setCategories([]));
  }, []);
  useEffect(() => {
    let current = true;
    setBusy(true);
    setError("");
    const query = selectedCategory
      ? `?categoryId=${encodeURIComponent(selectedCategory)}`
      : "";
    fetch(`/api/articles${query}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Could not load Daily Brief");
        if (!Array.isArray(data)) throw new Error("Could not load Daily Brief");
        if (current) setStories(data);
      })
      .catch((reason) => {
        if (current) setError(reason.message || "Could not load Daily Brief");
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [selectedCategory]);
  return (
    <div className="dash audienceDash">
      <AudienceSidebar active="overview" />
      <section className="content">
        <div className="top audienceTop">
          <div>
            <small>OVERVIEW / DAILY BRIEF</small>
            <h1>Daily Brief</h1>
            <p>Published reporting from across the community.</p>
          </div>
        </div>
        <nav className="categoryNav audienceCategoryNav" aria-label="News categories">
          <button
            className={!selectedCategory ? "active" : ""}
            aria-pressed={!selectedCategory}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              className={selectedCategory === category.id ? "active" : ""}
              aria-pressed={selectedCategory === category.id}
              onClick={() => setSelectedCategory(category.id)}
              key={category.id}
            >
              {category.name}
            </button>
          ))}
        </nav>
        {busy ? (
          <div className="panel emptyState">Loading stories…</div>
        ) : error ? (
          <div className="panel emptyState">{error}</div>
        ) : !stories.length ? (
          <div className="panel emptyState">
            No published stories in this category.
          </div>
        ) : (
          <section className="latest dailyBrief audienceDailyBrief">
            <div className="sectionTitle">
              <div>
                <span>THE DAILY BRIEF</span>
                <h2>What your city is talking about</h2>
              </div>
              <div className="dailyBriefActions">
                <small>{stories.length} published stories</small>
              </div>
            </div>
            <div className="dailyBriefTrack">
              {stories.map((story, index) => {
                const contentUrl = firstHttpUrl(story.content),
                  contentPreview = contentUrl
                    ? previewImageForUrl(contentUrl)
                    : null,
                  video = story.photos?.find((media) =>
                    isVideoUrl(media.url),
                  )?.url,
                  photo =
                    story.photos?.find((media) => !isVideoUrl(media.url))
                      ?.url ||
                    story.imageUrl ||
                    contentPreview,
                  dateValue = story.storyDate || story.publishedAt,
                  storyDateLabel = dateValue
                    ? new Date(dateValue).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Date not set";
                return (
                  <article key={story.id}>
                    {video ? (
                      <div className="dailyBriefThumbLink isVideo">
                        <div className={`thumb t${index % 3} hasVideo`}>
                          <video
                            src={video}
                            controls
                            playsInline
                            preload="metadata"
                            aria-label={`Video preview for ${story.title}`}
                          />
                          <span>{story.category.name}</span>
                        </div>
                      </div>
                    ) : (
                      <Link
                        className="dailyBriefThumbLink"
                        to={`/stories/${story.slug}`}
                        aria-label={`Read ${story.title}`}
                      >
                        <div
                          className={`thumb t${index % 3}${photo ? " hasImage" : ""}`}
                          style={
                            photo
                              ? { backgroundImage: `url(${photo})` }
                              : undefined
                          }
                        >
                          <span>{story.category.name}</span>
                        </div>
                      </Link>
                    )}
                    <div className="dailyBriefStoryBody">
                      <div className="dailyBriefStoryMeta">
                        <span>STORY DATE · {storyDateLabel}</span>
                        <div className="meta">
                          {story.category.name} ·{" "}
                          {Math.max(2, Math.round(story.content.length / 500))}{" "}
                          min read
                        </div>
                      </div>
                      <h3>
                        <Link to={`/stories/${story.slug}`}>{story.title}</Link>
                      </h3>
                      <RichText
                        value={story.excerpt}
                        className="cardRichSummary"
                      />
                      <div className="dailyBriefStoryFooter">
                        <div className="storyPrimaryActions">
                          <Link
                            className="cardReadStory"
                            to={`/stories/${story.slug}`}
                          >
                            Read Story <ArrowUpRight />
                          </Link>
                          <ShareStoryButton title={story.title} slug={story.slug} previewImage={photo} />
                        </div>
                        <div className="articleFoot">
                          <b>{story.author.name}</b>
                          <span>{story.views.toLocaleString()} views</span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
