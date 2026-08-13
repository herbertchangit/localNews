import { useEffect, useRef, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import "./story-share.css";

type ShareStoryButtonProps = {
  title: string;
  slug: string;
  className?: string;
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
    const url = new URL(`/stories/${encodeURIComponent(slug)}`, window.location.origin).href;
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
