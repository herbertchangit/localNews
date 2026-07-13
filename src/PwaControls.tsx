import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { registerSW } from "virtual:pwa-register";

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
