import { expect, it } from "vitest";
import { activeAppointmentCount } from "./activeAppointments";

it("counts only active, unexpired and unattended appointments", () => {
  const event = { eventDate: "2026-09-05" };
  const now = new Date("2026-09-05T04:00:00Z");
  expect(activeAppointmentCount([
    { event, status: "CONFIRMED", endTime: "13:00" },
    { event, status: "PENDING", endTime: "11:00" },
    ...["CANCELLED", "COMPLETED", "NO_SHOW"].map(status => ({event, status})),
    { event, status: "REGISTERED", registration: {} },
    { event, status: "REGISTERED", registration: { checkedInAt: now.toISOString() } },
    { event: { eventDate: "2026-09-04" }, status: "REGISTERED", registration: {} },
  ], now)).toBe(2);
});
it("returns zero when there are no active appointments", () => {
  expect(activeAppointmentCount([])).toBe(0);
});
