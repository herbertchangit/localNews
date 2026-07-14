import { describe, expect, it } from "vitest";
import { richTextToPlainText, sanitizeRichText, toRichTextHtml } from "./richTextUtils";

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
});
