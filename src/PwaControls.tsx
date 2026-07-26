import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import {
  APP_UPDATE_RESULT_EVENT,
  CHECK_APP_UPDATE_EVENT,
  type AppUpdateResult,
} from "./pwaEvents";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaControls() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [updateSW, setUpdateSW] = useState<null | ((reloadPage?: boolean) => Promise<void>)>(null);

  useEffect(() => {
    const install = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const installed = () => setInstallPrompt(null);
    const online = () => setOffline(false);
    const disconnected = () => setOffline(true);

    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", online);
    window.addEventListener("offline", disconnected);

    const updater = registerSW({
      immediate: true,
      onNeedRefresh: () => setUpdateAvailable(true),
    });
    setUpdateSW(() => updater);

    return () => {
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", disconnected);
    };
  }, []);

  useEffect(() => {
    const publish = (detail: AppUpdateResult) => {
      window.dispatchEvent(new CustomEvent(APP_UPDATE_RESULT_EVENT, { detail }));
    };
    const checkForUpdate = async () => {
      publish({ status: "checking", message: "Checking for the latest version…" });
      if (!("serviceWorker" in navigator)) {
        publish({ status: "error", message: "App updates are not supported by this browser." });
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        const installing = registration.installing;
        if (installing && installing.state !== "installed") {
          await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(resolve, 5000);
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" || installing.state === "redundant") {
                window.clearTimeout(timeout);
                resolve();
              }
            });
          });
        }
        if (registration.waiting && updateSW) {
          publish({ status: "updating", message: "Installing the latest version…" });
          await updateSW(true);
          return;
        }
        publish({ status: "latest", message: "You already have the latest version." });
      } catch {
        publish({ status: "error", message: "Could not check for updates. Try again." });
      }
    };
    window.addEventListener(CHECK_APP_UPDATE_EVENT, checkForUpdate);
    return () => window.removeEventListener(CHECK_APP_UPDATE_EVENT, checkForUpdate);
  }, [updateSW]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (!installPrompt && !updateAvailable && !offline) return null;

  return (
    <div className="pwaControls" role="status" aria-live="polite">
      {offline && (
        <span className="pwaOffline">
          <WifiOff /> Offline / 離線
        </span>
      )}
      {installPrompt && (
        <button type="button" onClick={install}>
          <Download /> Install app / 安裝應用程式
        </button>
      )}
      {updateAvailable && updateSW && (
        <button type="button" onClick={() => updateSW(true)}>
          <RefreshCw /> Update app / 更新應用程式
        </button>
      )}
    </div>
  );
}
