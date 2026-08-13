import { describe, expect, it } from "vitest";
import { absoluteWebUrl, injectSocialMeta, plainText, youtubeThumbnailFromText } from "../server/socialPreview";

describe("story social previews", () => {
  it("turns rich text into a concise description", () => {
    expect(plainText("<p>Hello &amp; welcome</p><p>Local news</p>")).toBe("Hello & welcome Local news");
  });

  it("creates an absolute URL for uploaded images", () => {
    expect(absoluteWebUrl("/uploads/story.jpg", "https://news.example")).toBe("https://news.example/uploads/story.jpg");
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
    expect(result).toContain('name="twitter:card" content="summary_large_image"');
  });
});
