import { describe, expect, it } from "vitest";
import { newsroomStoryWhere, viewerStoryWhere } from "./storyHarmony";

describe("newsroomStoryWhere", () => {
  it("limits every signed-in user to stories in their harmony", () => {
    expect(
      newsroomStoryWhere({ harmony: "Harmony A", userId: "user-1" }),
    ).toEqual({ harmony: "Harmony A" });
  });

  it("falls back to a user's own stories when no harmony is assigned", () => {
    expect(
      newsroomStoryWhere({ harmony: null, userId: "user-1" }),
    ).toEqual({ authorId: "user-1" });
  });

  it("leaves the public story board unscoped when no user is signed in", () => {
    expect(viewerStoryWhere()).toEqual({});
  });
});
