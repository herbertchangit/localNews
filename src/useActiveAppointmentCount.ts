import { useEffect, useState } from "react";
import { activeAppointmentCount } from "./activeAppointments";

export function useActiveAppointmentCount(token: string | undefined, isDoctor: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!token) { setCount(0); return; }
    let active = true;
    const refresh = () => fetch(isDoctor ? "/api/doctor/health/appointments" : "/api/health-events/appointments/mine", {
      headers: { Authorization: `Bearer ${token}` },
    }).then(response => response.ok ? response.json() : [])
      .then(items => { if (active) setCount(activeAppointmentCount(Array.isArray(items) ? items : [])); })
      .catch(() => { if (active) setCount(0); });
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("localnews:appointments-updated", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("localnews:appointments-updated", refresh);
    };
  }, [token, isDoctor]);
  return count;
}
