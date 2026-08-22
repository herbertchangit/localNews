const htmlEntities: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export const plainText = (value: string) =>
  value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/gi, (entity) => htmlEntities[entity.toLowerCase()] || entity)
    .replace(/\s+/g, " ")
    .trim();

export const escapeMeta = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export const absoluteWebUrl = (value: string, origin: string) => {
  try {
    return new URL(value, origin).href;
  } catch {
    return "";
  }
};

export const storySocialUrl = (slug: string, origin: string, preview?: unknown) => {
  const url = absoluteWebUrl(`/stories/${encodeURIComponent(slug)}`, origin);
  if (!url) return "";
  const result = new URL(url);
  if (typeof preview === "string" && /^[a-z0-9]+$/i.test(preview))
    result.searchParams.set("preview", preview);
  return result.href;
};

export const youtubeThumbnailFromText = (value: string) => {
  const match = value.match(/https?:\/\/[^\s<>'"]+/i);
  if (!match) return "";
  try {
    const url = new URL(match[0].replace(/&amp;/g, "&"));
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (hostname === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    if (["youtube.com", "m.youtube.com"].includes(hostname)) {
      id = url.searchParams.get("v") || "";
      if (!id) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0])) id = parts[1] || "";
      }
    }
    return /^[A-Za-z0-9_-]{6,}$/.test(id)
      ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      : "";
  } catch {
    return "";
  }
};

type SocialMeta = {
  title: string;
  description: string;
  url: string;
  image?: string;
};

export const socialImageType = (value: string) => {
  try {
    const extension = new URL(value).pathname.split(".").pop()?.toLowerCase();
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
  } catch {}
  return "";
};

export const injectSocialMeta = (html: string, meta: SocialMeta) => {
  const title = escapeMeta(meta.title);
  const description = escapeMeta(meta.description);
  const url = escapeMeta(meta.url);
  const image = meta.image ? escapeMeta(meta.image) : "";
  const imageType = meta.image ? socialImageType(meta.image) : "";
  const tags = [
    `<meta property="og:type" content="article" />`,
    `<meta property="og:site_name" content="Local News" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    image ? `<meta property="og:image" content="${image}" />` : "",
    image ? `<meta property="og:image:secure_url" content="${image}" />` : "",
    imageType ? `<meta property="og:image:type" content="${imageType}" />` : "",
    image ? `<meta property="og:image:alt" content="${title}" />` : "",
    image ? `<meta name="twitter:image" content="${image}" />` : "",
    `<link rel="canonical" href="${url}" />`,
  ].filter(Boolean).join("\n    ");

  return html
    .replace(/<title>[^<]*<\/title>/i, `<title>${title} | Local News</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${description}" />`)
    .replace("</head>", `    ${tags}\n  </head>`);
};
