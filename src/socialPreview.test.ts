import { describe, expect, it } from "vitest";
import { absoluteWebUrl, injectSocialMeta, plainText, socialImageType, storySocialUrl, youtubeThumbnailFromText } from "../server/socialPreview";

describe("story social previews", () => {
  it("turns rich text into a concise description", () => {
    expect(plainText("<p>Hello &amp; welcome</p><p>Local news</p>")).toBe("Hello & welcome Local news");
  });

  it("creates an absolute URL for uploaded images", () => {
    expect(absoluteWebUrl("/uploads/story.jpg", "https://news.example")).toBe("https://news.example/uploads/story.jpg");
  });

  it("keeps a safe preview fingerprint in the social canonical URL", () => {
    expect(storySocialUrl("city update", "https://news.example", "photo123"))
      .toBe("https://news.example/stories/city%20update?preview=photo123");
    expect(storySocialUrl("city-update", "https://news.example", "bad/value"))
      .toBe("https://news.example/stories/city-update");
  });

  it("uses a YouTube thumbnail when a story only contains a video link", () => {
    expect(youtubeThumbnailFromText("Watch https://youtu.be/abcDEF_1234 now")).toBe("https://i.ytimg.com/vi/abcDEF_1234/hqdefault.jpg");
  });

  it("injects escaped Open Graph metadata", () => {
    const result = injectSocialMeta("<head><title>Local News</title><meta name=\"description\" content=\"Default\" /></head>", {
      title: 'City "Update"',
      description: "News & events",
      url: "https://news.example/stories/update",
      image: "https://news.example/uploads/update.jpg",
    });
    expect(result).toContain('property="og:title" content="City &quot;Update&quot;"');
    expect(result).toContain('property="og:image" content="https://news.example/uploads/update.jpg"');
    expect(result).toContain('property="og:image:type" content="image/jpeg"');
    expect(result).toContain('property="og:image:alt" content="City &quot;Update&quot;"');
    expect(result).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("reports supported social image MIME types", () => {
    expect(socialImageType("https://news.example/photo.png?v=2")).toBe("image/png");
    expect(socialImageType("https://news.example/photo.webp")).toBe("image/webp");
  });
});
