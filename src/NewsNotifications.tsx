import { useEffect, useState } from "react";
import { ArrowUpRight, Bell, CheckCheck, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type NotificationStory = {
  id: string;
  title: string;
  slug: string;
  publishedAt?: string;
  category: { name: string };
  author: { name: string };
};

type BadgingNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const readStoriesKey = "ln_read_story_ids";

const readStoryIds = () => {
  try {
    const ids = JSON.parse(localStorage.getItem(readStoriesKey) || "[]");
    return new Set<string>(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set<string>();
  }
};

const saveReadStoryIds = (ids: Set<string>) => localStorage.setItem(readStoriesKey, JSON.stringify([...ids]));

export default function NewsNotifications() {
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState<NotificationStory[]>([]);
  const [dismissedStoryId, setDismissedStoryId] = useState("");
  const publicPage = !location.pathname.startsWith("/newsroom") && location.pathname !== "/login";

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/articles", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const stories: NotificationStory[] = await response.json();
        if (!active) return;
        const readIds = readStoryIds();
        const currentSlug = location.pathname.startsWith("/stories/") ? decodeURIComponent(location.pathname.slice(9)) : "";
        const currentStory = stories.find((story) => story.slug === currentSlug);
        if (currentStory) {
          readIds.add(currentStory.id);
          saveReadStoryIds(readIds);
        }
        setUnread(stories.filter((story) => !readIds.has(story.id)));
      } catch {
        // Notifications should never interrupt reading when the news feed is unavailable.
      }
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") load(); };
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [location.pathname]);

  useEffect(() => {
    const appNavigator = navigator as BadgingNavigator;
    const updateBadge = unread.length ? appNavigator.setAppBadge?.(unread.length) : appNavigator.clearAppBadge?.();
    updateBadge?.catch(() => undefined);
  }, [unread.length]);

  const markRead = (storyIds: string[]) => {
    const readIds = readStoryIds();
    storyIds.forEach((id) => readIds.add(id));
    saveReadStoryIds(readIds);
    setUnread((stories) => stories.filter((story) => !readIds.has(story.id)));
  };

  const latest = unread[0];
  const openLatest = () => {
    if (!latest) return;
    markRead([latest.id]);
    navigate(`/stories/${latest.slug}`);
  };
  const markAllRead = () => {
    markRead(unread.map((story) => story.id));
    setDismissedStoryId("");
  };
  const notificationVisible = publicPage && latest && dismissedStoryId !== latest.id;

  return <>
    {notificationVisible && <aside className="newsNotification" role="status" aria-live="polite">
      <span className="newsNotificationIcon"><Bell /><b>{unread.length}</b></span>
      <div><small>NEW LOCAL STORY / 新聞通知</small><strong>{latest.title}</strong><p>{latest.category.name} · {latest.author.name}</p></div>
      <button className="newsNotificationRead" type="button" onClick={openLatest}>Read story <ArrowUpRight /></button>
      <button className="newsNotificationClear" type="button" onClick={markAllRead}><CheckCheck />Mark all read</button>
      <button className="newsNotificationClose" type="button" aria-label="Dismiss news notification" onClick={() => setDismissedStoryId(latest.id)}><X /></button>
    </aside>}
    {publicPage && latest && !notificationVisible && <button className="newsUnreadBadge" type="button" aria-label={`${unread.length} unread news stories`} onClick={() => setDismissedStoryId("")}><Bell /><span>{unread.length}</span></button>}
  </>;
}
