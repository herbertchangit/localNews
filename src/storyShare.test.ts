import { describe, expect, it } from "vitest";
import {
  storySharePreviewVersion,
  storyShareText,
  storyShareUrl,
} from "./ShareStoryButton";

describe("story share links", () => {
  it("adds a stable preview-photo fingerprint for social cache refresh", () => {
    const first = storyShareUrl("https://news.example", "city-update", "/uploads/photo-1.jpg");
    const repeated = storyShareUrl("https://news.example", "city-update", "/uploads/photo-1.jpg");
    const changed = storyShareUrl("https://news.example", "city-update", "/uploads/photo-2.jpg");

    expect(first).toBe(repeated);
    expect(first).not.toBe(changed);
    expect(first).toContain("/stories/city-update?preview=");
  });

  it("produces a compact deterministic fingerprint", () => {
    expect(storySharePreviewVersion("/uploads/photo.jpg")).toMatch(/^[a-z0-9]+$/);
  });

  it("copies the story title and link together", () => {
    expect(
      storyShareText(
        "  Community garden opens  ",
        "https://news.example/stories/community-garden",
      ),
    ).toBe(
      "Community garden opens\nhttps://news.example/stories/community-garden",
    );
  });
});
