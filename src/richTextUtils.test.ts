import { describe, expect, it } from "vitest";
import { firstHttpUrl, previewImageForUrl, richTextToPlainText, sanitizeRichText, toRichTextHtml } from "./richTextUtils";

describe("rich text utilities", () => {
  it("keeps supported formatting", () => {
    expect(sanitizeRichText("<h2>Update</h2><p><strong>Important</strong> news</p><ul><li>One</li></ul>"))
      .toBe("<h2>Update</h2><p><strong>Important</strong> news</p><ul><li>One</li></ul>");
  });

  it("removes scripts, event handlers, and unsafe links", () => {
    const result = sanitizeRichText('<p onclick="alert(1)">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain("script");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("javascript:");
    expect(result).toContain("Safe");
  });

  it("converts legacy plain text into paragraphs", () => {
    expect(toRichTextHtml("First paragraph\n\nSecond line"))
      .toBe("<p>First paragraph</p><p>Second line</p>");
  });

  it("counts visible text without HTML markup", () => {
    expect(richTextToPlainText("<p>Hello <strong>local</strong></p><p>news</p>"))
      .toBe("Hello local news");
  });

  it("finds the first HTTP URL in rich text", () => {
    expect(firstHttpUrl('<p>See <a href="https://images.example/lead.jpg?size=large&amp;crop=1">the photo</a></p>'))
      .toBe("https://images.example/lead.jpg?size=large&crop=1");
    expect(firstHttpUrl("First https://example.com/photo.webp, then https://example.com/second.jpg"))
      .toBe("https://example.com/photo.webp");
  });

  it("returns null when story content has no valid web URL", () => {
    expect(firstHttpUrl("No link in this story")).toBeNull();
  });

  it("creates preview images for YouTube and direct image URLs", () => {
    expect(previewImageForUrl("https://youtu.be/hAi1SftBbJOY?si=example"))
      .toBe("https://i.ytimg.com/vi/hAi1SftBbJOY/hqdefault.jpg");
    expect(previewImageForUrl("https://www.youtube.com/watch?v=hAi1SftBbJOY"))
      .toBe("https://i.ytimg.com/vi/hAi1SftBbJOY/hqdefault.jpg");
    expect(previewImageForUrl("https://images.example/photo.webp?width=800"))
      .toBe("https://images.example/photo.webp?width=800");
    expect(previewImageForUrl("https://example.com/article")).toBeNull();
  });
});
