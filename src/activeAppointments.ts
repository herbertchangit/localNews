import { appointmentExpired } from "../server/appointmentExpiry";

type AppointmentSummary = {
  status: string;
  event: { eventDate: string };
  endTime?: string | null;
  registration?: { checkedInAt?: string | null } | null;
};

export function activeAppointmentCount(items: AppointmentSummary[], now = new Date()) {
  return items.filter(item =>
    ["PENDING", "CONFIRMED", "REGISTERED"].includes(item.status) &&
    !item.registration?.checkedInAt &&
    !appointmentExpired(item.event.eventDate, item.registration ? null : item.endTime, now)
  ).length;
}
