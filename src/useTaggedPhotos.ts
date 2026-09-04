import { useEffect, useState } from "react";

/** Reuse the gallery endpoint so menu eligibility has identical access checks. */
export function useTaggedPhotos(token: string, pathname: string) {
  const [hasPhotos, setHasPhotos] = useState(false);
  useEffect(() => {
    let active = true;
    let request = 0;
    setHasPhotos(false);
    const refresh = async () => {
      const currentRequest = ++request;
      try {
        const response = await fetch("/api/me/photos", { headers: { Authorization: `Bearer ${token}` } });
        const photos = response.ok ? await response.json() : [];
        if (active && currentRequest === request) setHasPhotos(Array.isArray(photos) && photos.length > 0);
      } catch {
        if (active && currentRequest === request) setHasPhotos(false);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("localnews:photo-tags-updated", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("localnews:photo-tags-updated", refresh);
    };
  }, [token, pathname]);
  return hasPhotos;
}
