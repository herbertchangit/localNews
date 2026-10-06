import { describe, expect, it } from "vitest";
import { roleProfilesAllowStoryCreation } from "./storyCreationAccess";

describe("roleProfilesAllowStoryCreation", () => {
  it("allows creation when any assigned role grants Stories New", () => {
    expect(
      roleProfilesAllowStoryCreation([
        { menuIds: ["overview"], authorities: { overview: ["view"] } },
        {
          menuIds: ["stories"],
          authorities: { stories: ["view", "new"] },
        },
      ]),
    ).toBe(true);
  });

  it("rejects a visible Stories menu without New authority", () => {
    expect(
      roleProfilesAllowStoryCreation([
        { menuIds: ["stories"], authorities: { stories: ["view", "edit"] } },
      ]),
    ).toBe(false);
  });

  it("supports legacy visible-menu profiles without action columns", () => {
    expect(
      roleProfilesAllowStoryCreation([
        { menuIds: ["stories"], authorities: {} },
      ]),
    ).toBe(true);
  });
});
