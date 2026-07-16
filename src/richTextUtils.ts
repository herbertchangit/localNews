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

export function firstHttpUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;

  const candidate = match[0]
    .replace(/&amp;/gi, "&")
    .replace(/[),.;!?]+$/, "");

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function previewImageForUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let youtubeId: string | null = null;

    if (hostname === "youtu.be") {
      youtubeId = url.pathname.split("/").filter(Boolean)[0] || null;
    } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      youtubeId = url.searchParams.get("v");
      if (!youtubeId) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0])) youtubeId = parts[1] || null;
      }
    }

    if (youtubeId && /^[A-Za-z0-9_-]{6,}$/.test(youtubeId)) {
      return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
    }

    return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
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
