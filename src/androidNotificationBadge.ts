export type BadgeNotificationStory = {
  id: string;
  title: string;
  slug: string;
  publishedAt?: string;
};

export const storyNotificationTag = (storyId: string) =>
  `local-news-unread:${storyId}`;

const isStoryNotification = (notification: Notification) =>
  notification.tag.startsWith("local-news-unread:");

export async function syncAndroidStoryNotifications(
  registration: ServiceWorkerRegistration,
  unreadStories: BadgeNotificationStory[],
) {
  const existing = (await registration.getNotifications()).filter(
    isStoryNotification,
  );
  const unreadTags = new Set(
    unreadStories.map((story) => storyNotificationTag(story.id)),
  );

  existing.forEach((notification) => {
    if (!unreadTags.has(notification.tag)) notification.close();
  });

  const activeTags = new Set(
    existing
      .filter((notification) => unreadTags.has(notification.tag))
      .map((notification) => notification.tag),
  );
  await Promise.all(
    unreadStories
      .filter((story) => !activeTags.has(storyNotificationTag(story.id)))
      .map((story) =>
        registration.showNotification("Unread Local News story", {
          body: story.title,
          icon: "/pwa/icon-192.png",
          badge: "/pwa/icon-192.png",
          tag: storyNotificationTag(story.id),
          silent: true,
          timestamp: story.publishedAt
            ? new Date(story.publishedAt).getTime()
            : Date.now(),
          data: { url: `/stories/${story.slug}` },
        }),
      ),
  );
}
