import { appointmentExpired } from "../server/appointmentExpiry";

type AppointmentCard = {
  endTime?: string | null;
  registration?: unknown;
  event: {
    eventDate: string;
    toEventDate?: string | null;
  };
};

export const appointmentCardExpired = (
  item: AppointmentCard,
  now = new Date(),
) => appointmentExpired(
  item.registration
    ? item.event.toEventDate || item.event.eventDate
    : item.event.eventDate,
  item.registration ? null : item.endTime,
  now,
);
