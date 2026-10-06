import { describe, expect, it } from "vitest";
import {
  groupingWhereForHarmony,
  storyVisibilityData,
  viewerStoryVisibilityWhere,
} from "./storyVisibility";

describe("story visibility", () => {
  it("keeps Public stories public and clears their group", () => {
    expect(storyVisibilityData("PUBLIC", "group-1")).toEqual({
      visibility: "PUBLIC",
      visibilityGroupId: null,
      isPublic: true,
    });
  });

  it("requires group membership for Group stories", () => {
    expect(viewerStoryVisibilityWhere({ userId: "user-1", volunteer: false })).toEqual({
      OR: [
        { visibility: "PUBLIC" },
        {
          visibility: "GROUP",
          visibilityGroup: { users: { some: { id: "user-1" } } },
        },
      ],
    });
  });

  it("allows Volunteers to read Private stories", () => {
    expect(viewerStoryVisibilityWhere({ userId: "user-1", volunteer: true }).OR)
      .toContainEqual({ visibility: "PRIVATE" });
  });

  it("filters grouping choices by Harmony", () => {
    expect(groupingWhereForHarmony("harmony-1")).toEqual({
      harmonyGroupId: "harmony-1",
    });
    expect(groupingWhereForHarmony(null)).toEqual({ id: { in: [] } });
  });
});
