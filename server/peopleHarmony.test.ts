import { describe, expect, it } from "vitest";
import { hasPeopleHarmony, peopleWhereForHarmony } from "./peopleHarmony";

describe("People Harmony scope", () => {
  it("filters delegated People access by Harmony only", () => {
    expect(
      peopleWhereForHarmony({ admin: false, harmonyGroupId: "harmony-1" }),
    ).toEqual({
      harmonyGroupId: "harmony-1",
      NOT: { OR: [{ role: "ADMIN" }, { roles: { has: "ADMIN" } }] },
    });
  });

  it("does not require a MutualLove assignment", () => {
    expect(hasPeopleHarmony({ admin: false, harmonyGroupId: "harmony-1" })).toBe(true);
    expect(hasPeopleHarmony({ admin: false, harmonyGroupId: null })).toBe(false);
  });

  it("keeps the Administrator People list unrestricted", () => {
    expect(peopleWhereForHarmony({ admin: true, harmonyGroupId: null })).toEqual({});
    expect(hasPeopleHarmony({ admin: true, harmonyGroupId: null })).toBe(true);
  });
});
