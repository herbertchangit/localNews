import { describe, expect, it } from "vitest";
import { taggedPhotoWhere } from "../server/taggedPhotos";
describe("tagged photos after unpublishing", () => {
  it("does not filter on publication status", () => {
    expect(taggedPhotoWhere("viewer", true).article).not.toHaveProperty("status");
    expect(taggedPhotoWhere("viewer", false).article).not.toHaveProperty("status");
  });
  it("always limits photos to the authenticated user's tags", () => {
    expect(taggedPhotoWhere("viewer", true).userTags).toEqual({ some: { userId: "viewer" } });
  });
  it("retains private-story restrictions", () => {
    expect(taggedPhotoWhere("viewer", false).article).toEqual({ isPublic: true });
    expect(taggedPhotoWhere("viewer", true).article).toEqual({});
  });
});
