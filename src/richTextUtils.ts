import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
];

const options: sanitizeHtml.IOptions = {
  allowedTags,
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: (_tagName, attributes) => ({
      tagName: "a",
      attribs: {
        ...attributes,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
  },
};

export function sanitizeRichText(value: string) {
  return sanitizeHtml(value, options).trim();
}

export function richTextToPlainText(value: string) {
  const separated = value.replace(/<\/(p|h[1-6]|li|blockquote)>/gi, " ").replace(/<br\s*\/?\s*>/gi, " ");
  return sanitizeHtml(separated, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function toRichTextHtml(value: string) {
  if (!value.trim()) return "";
  if (/<\/?(?:p|br|strong|b|em|i|u|h2|h3|ul|ol|li|blockquote|a)\b/i.test(value)) {
    return sanitizeRichText(value);
  }

  return value
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
