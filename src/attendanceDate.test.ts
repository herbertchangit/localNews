import { describe, expect, it } from "vitest";
import { attendanceDateError, malaysiaDateKey } from "../server/attendanceDate";

describe("registration attendance date validation", () => {
  const malaysiaMorning = new Date("2026-08-21T01:00:00.000Z");

  it("uses the current Malaysia calendar date", () => {
    expect(malaysiaDateKey(new Date("2026-08-20T16:30:00.000Z"))).toBe(
      "2026-08-21",
    );
  });

  it("allows attendance only on the matching event date", () => {
    expect(
      attendanceDateError(
        new Date("2026-08-21T00:00:00.000Z"),
        malaysiaMorning,
      ),
    ).toBeNull();
  });

  it("rejects future and expired QR event dates", () => {
    expect(
      attendanceDateError(
        new Date("2026-08-22T00:00:00.000Z"),
        malaysiaMorning,
      ),
    ).toContain("cannot be marked before");
    expect(
      attendanceDateError(
        new Date("2026-08-20T00:00:00.000Z"),
        malaysiaMorning,
      ),
    ).toContain("expired");
  });
});
