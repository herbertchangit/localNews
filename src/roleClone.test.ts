import { describe, expect, it } from "vitest";
import { canCloneRole, nextRoleCloneName } from "./RoleManagement";

describe("role cloning", () => {
  it("allows every role except Admin to be cloned", () => {
    expect(canCloneRole("ADMIN")).toBe(false);
    expect(canCloneRole("admin")).toBe(false);
    expect(canCloneRole("ADMIN_MEDICAL")).toBe(true);
    expect(canCloneRole("REGISTRATION_COORDINATOR")).toBe(true);
  });

  it("generates the next available clone name", () => {
    expect(nextRoleCloneName("Volunteer", ["Admin", "Volunteer"])).toBe("Volunteer Copy");
    expect(nextRoleCloneName("Volunteer", ["Volunteer Copy", "volunteer copy 2"])).toBe("Volunteer Copy 3");
  });
});
