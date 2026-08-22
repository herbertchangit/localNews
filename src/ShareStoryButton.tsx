import { useEffect, useRef, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import "./story-share.css";

type ShareStoryButtonProps = {
  title: string;
  slug: string;
  previewImage?: string | null;
  className?: string;
};

export const storySharePreviewVersion = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const storyShareUrl = (origin: string, slug: string, previewImage?: string | null) => {
  const url = new URL(`/stories/${encodeURIComponent(slug)}`, origin);
  url.searchParams.set("preview", storySharePreviewVersion(previewImage || slug));
  return url.href;
};

const copyLink = async (url: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const input = document.createElement("textarea");
  input.value = url;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy failed");
};

export default function ShareStoryButton({
  title,
  slug,
  previewImage,
  className = "",
}: ShareStoryButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const resetStatusLater = () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 2500);
  };

  const share = async () => {
    // The stable image fingerprint makes WhatsApp fetch fresh Open Graph data
    // after a story photo changes instead of reusing its cached no-photo card.
    const url = storyShareUrl(window.location.origin, slug, previewImage);
    const prefersNativeShare =
      typeof navigator.share === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    try {
      if (prefersNativeShare) {
        await navigator.share({ title, text: title, url });
        return;
      }
      await copyLink(url);
      setStatus("copied");
      resetStatusLater();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
      resetStatusLater();
    }
  };

  const label =
    status === "copied"
      ? "Link copied"
      : status === "error"
        ? "Unable to share"
        : "Share";

  return (
    <button
      type="button"
      className={`shareStoryButton ${className}`.trim()}
      onClick={share}
      aria-label={`${label}: ${title}`}
    >
      {status === "copied" ? <Check /> : status === "error" ? <Link2 /> : <Share2 />}
      <span>{label}</span>
    </button>
  );
}
