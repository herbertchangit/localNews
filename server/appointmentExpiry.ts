import { malaysiaDateKey } from "./attendanceDate.js";

export function appointmentExpired(eventDate: string | Date, endTime?: string | null, now = new Date()) {
  const date = eventDate instanceof Date ? eventDate.toISOString().slice(0, 10) : eventDate.slice(0, 10);
  const today = malaysiaDateKey(now);
  if (date !== today) return date < today;
  if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) return false;
  const localTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(11, 16);
  return localTime >= endTime;
}
