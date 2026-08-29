import { describe, expect, it, vi } from "vitest";
import {
  storyNotificationTag,
  syncAndroidStoryNotifications,
} from "./androidNotificationBadge";

const story = (id: string) => ({
  id,
  title: `Story ${id}`,
  slug: `story-${id}`,
  publishedAt: "2026-08-29T08:00:00.000Z",
});

describe("Android notification-backed app badges", () => {
  it("creates one system notification for each unread story", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const registration = {
      getNotifications: vi.fn().mockResolvedValue([]),
      showNotification,
    } as unknown as ServiceWorkerRegistration;

    await syncAndroidStoryNotifications(registration, [story("one")]);

    expect(showNotification).toHaveBeenCalledWith(
      "Unread Local News story",
      expect.objectContaining({
        body: "Story one",
        tag: storyNotificationTag("one"),
        data: { url: "/stories/story-one" },
      }),
    );
  });

  it("keeps current notifications and closes notifications that were read", async () => {
    const closeRead = vi.fn();
    const keepUnread = vi.fn();
    const registration = {
      getNotifications: vi.fn().mockResolvedValue([
        { tag: storyNotificationTag("read"), close: closeRead },
        { tag: storyNotificationTag("unread"), close: keepUnread },
      ]),
      showNotification: vi.fn().mockResolvedValue(undefined),
    } as unknown as ServiceWorkerRegistration;

    await syncAndroidStoryNotifications(registration, [story("unread")]);

    expect(closeRead).toHaveBeenCalledOnce();
    expect(keepUnread).not.toHaveBeenCalled();
    expect(registration.showNotification).not.toHaveBeenCalled();
  });
});
