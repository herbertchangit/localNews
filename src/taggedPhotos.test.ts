import { describe, expect, it } from "vitest";
import { taggedPhotoWhere } from "../server/taggedPhotos";
describe("tagged photos after unpublishing", () => {
  const visibility = { OR: [{ visibility: "PUBLIC" }, { visibility: "GROUP" }] };

  it("does not filter on publication status", () => {
    expect(taggedPhotoWhere("viewer", visibility).article).not.toHaveProperty("status");
  });
  it("always limits photos to the authenticated user's tags", () => {
    expect(taggedPhotoWhere("viewer", visibility).userTags).toEqual({ some: { userId: "viewer" } });
  });
  it("retains the viewer's story audience restrictions", () => {
    expect(taggedPhotoWhere("viewer", visibility).article).toEqual(visibility);
  });
});
