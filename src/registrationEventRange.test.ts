import { describe, expect, it } from "vitest";
import { validRegistrationEventRange } from "../server/registrationEventRange";

describe("registration event date range", () => {
  it("allows a one-day event", () => {
    expect(validRegistrationEventRange("2026-10-10", "2026-10-10")).toBe(true);
  });

  it("allows a multi-day event", () => {
    expect(validRegistrationEventRange("2026-10-10", "2026-10-12")).toBe(true);
  });

  it("rejects an end date before the start date", () => {
    expect(validRegistrationEventRange("2026-10-12", "2026-10-10")).toBe(false);
  });
});
