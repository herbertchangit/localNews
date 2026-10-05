import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAssignRoleHarmony } from "../server/roleMenus";

describe("role Harmony assignment", () => {
  it("allows an administrator, including through a secondary built-in role", () => {
    expect(canAssignRoleHarmony({ role: Role.ADMIN, roles: [] })).toBe(true);
    expect(canAssignRoleHarmony({ role: Role.DADE, roles: [Role.ADMIN] })).toBe(true);
  });

  it("does not treat delegated role-menu authority as administrator access", () => {
    expect(canAssignRoleHarmony({ role: Role.EDITOR, roles: [Role.VOLUNTEER] })).toBe(false);
    expect(canAssignRoleHarmony({ role: Role.DADE, roles: [] })).toBe(false);
  });
});
