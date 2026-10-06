import { describe, expect, it } from "vitest";
import { appointmentCardExpired } from "./appointmentCardState";

describe("appointment/order card expiry", () => {
  const now = new Date("2026-10-06T04:00:00Z");

  it("disables a one-day registration after its event date", () => {
    expect(appointmentCardExpired({
      registration: { dateFree: true },
      event: { eventDate: "2026-10-05" },
    }, now)).toBe(true);
  });

  it("keeps a multi-day registration enabled through its ending date", () => {
    expect(appointmentCardExpired({
      registration: {},
      event: { eventDate: "2026-10-05", toEventDate: "2026-10-07" },
    }, now)).toBe(false);
  });

  it("uses the appointment end time for a health appointment", () => {
    expect(appointmentCardExpired({
      endTime: "11:59",
      event: { eventDate: "2026-10-06" },
    }, now)).toBe(true);
  });
});
