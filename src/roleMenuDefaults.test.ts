import { describe, expect, it } from "vitest";
import { defaultMenusForRole } from "./roleMenuDefaults";

describe("role menu defaults", () => {
  it.each(["DADE", "VOLUNTEER", "EDITOR", "DOCTOR", "ADMIN_MEDICAL"])(
    "requires explicit Role visibility for Talk With Doc and Appointments/Orders for %s",
    (role) => {
      expect(defaultMenusForRole(role)?.has("talk_with_doc")).toBe(false);
      expect(defaultMenusForRole(role)?.has("appointments")).toBe(false);
    },
  );

  it("keeps the system administrator unrestricted", () => {
    expect(defaultMenusForRole("ADMIN")).toBeNull();
  });
});
