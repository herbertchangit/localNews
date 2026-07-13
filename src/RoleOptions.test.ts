import { describe, expect, it } from "vitest";
import { normalizeLegacyRole, ROLE_CHOICES } from "./RoleOptions";

describe("user-management role choices", () => {
  it("offers Editor as a distinct persisted role", () => {
    expect(ROLE_CHOICES.map(([value]) => value)).toEqual(["ADMIN", "EDITOR", "VOLUNTEER", "DADE"]);
    expect(normalizeLegacyRole("EDITOR")).toBe("EDITOR");
  });

  it("maps only legacy roles to the current role names", () => {
    expect(normalizeLegacyRole("REPORTER")).toBe("VOLUNTEER");
    expect(normalizeLegacyRole("AUDIENCE")).toBe("DADE");
  });
});
