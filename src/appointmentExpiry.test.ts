import { describe, expect, it } from "vitest";
import { appointmentExpired } from "../server/appointmentExpiry";

describe("appointment expiry", () => {
  const now = new Date("2026-09-04T04:00:00Z");
  it("expires past dates but keeps today and future dates available", () => {
    expect(appointmentExpired("2026-09-03", null, now)).toBe(true);
    expect(appointmentExpired("2026-09-04", null, now)).toBe(false);
    expect(appointmentExpired("2026-09-05", "09:00", now)).toBe(false);
  });
  it("expires doctor appointments at their Malaysia end time", () => {
    expect(appointmentExpired("2026-09-04", "12:00", now)).toBe(true);
    expect(appointmentExpired("2026-09-04", "12:01", now)).toBe(false);
  });
  it("uses Malaysia midnight for date-only registrations", () => {
    expect(appointmentExpired(new Date("2026-09-04T00:00:00Z"), null, new Date("2026-09-04T16:00:00Z"))).toBe(true);
  });
});
