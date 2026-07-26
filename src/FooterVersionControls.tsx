import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import packageInfo from "../package.json";
import {
  APP_UPDATE_RESULT_EVENT,
  CHECK_APP_UPDATE_EVENT,
  type AppUpdateResult,
} from "./pwaEvents";

export default function FooterVersionControls() {
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  const [result, setResult] = useState<AppUpdateResult | null>(null);

  useEffect(() => {
    const findFooter = () => setFooter(document.querySelector("footer"));
    findFooter();
    const observer = new MutationObserver(findFooter);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let clearResult = 0;
    const showResult = (event: Event) => {
      const detail = (event as CustomEvent<AppUpdateResult>).detail;
      setResult(detail);
      window.clearTimeout(clearResult);
      if (detail.status === "latest" || detail.status === "error") {
        clearResult = window.setTimeout(() => setResult(null), 5000);
      }
    };
    window.addEventListener(APP_UPDATE_RESULT_EVENT, showResult);
    return () => {
      window.clearTimeout(clearResult);
      window.removeEventListener(APP_UPDATE_RESULT_EVENT, showResult);
    };
  }, []);

  if (!footer) return null;

  const checking = result?.status === "checking" || result?.status === "updating";
  return createPortal(
    <div className="footerVersionControls" aria-live="polite">
      <span>Version {packageInfo.version}</span>
      <button
        type="button"
        disabled={checking}
        onClick={() => window.dispatchEvent(new Event(CHECK_APP_UPDATE_EVENT))}
      >
        <RefreshCw className={checking ? "spinning" : ""} />
        {result?.status === "checking"
          ? "Checking…"
          : result?.status === "updating"
            ? "Updating…"
            : "Update app"}
      </button>
      {result && result.status !== "checking" && result.status !== "updating" && (
        <small className={result.status}>{result.message}</small>
      )}
    </div>,
    footer,
  );
}
