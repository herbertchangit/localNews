import { describe, expect, it } from "vitest";
import { registrationIdentityForRole, registrationPrefill } from "./registrationPrefill";

describe("logged-in registration prefill", () => {
  it("maps only Volunteer accounts to the Volunteer identity", () => {
    expect(registrationIdentityForRole("VOLUNTEER")).toBe("VOLUNTEER");
    expect(registrationIdentityForRole("DADE")).toBe("NON_VOLUNTEER");
    expect(registrationIdentityForRole("ADMIN")).toBe("NON_VOLUNTEER");
  });

  it("uses the account full name and contact", () => {
    expect(registrationPrefill({ name: "  Herbert Chan  ", role: "VOLUNTEER" }, " 012-345 6789 ", " Bandar Puteri ")).toEqual({
      registrantName: "Herbert Chan",
      identity: "VOLUNTEER",
      contact: "012-345 6789",
      area: "Bandar Puteri",
    });
  });
});
