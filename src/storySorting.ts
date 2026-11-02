export type StorySortKey = "story" | "status" | "storyDate";
export type StorySortDirection = "asc" | "desc";
export type StorySort = {
  key: StorySortKey;
  direction: StorySortDirection;
};

type SortableStory = {
  title: string;
  status: string;
  storyDate?: string | null;
};

const statusLabel = (status: string) =>
  status === "ARCHIVED" ? "EXPIRED" : status;

export function sortStories<T extends SortableStory>(
  stories: T[],
  sort: StorySort,
) {
  return [...stories].sort((left, right) => {
    if (sort.key === "storyDate") {
      if (!left.storyDate && !right.storyDate)
        return left.title.localeCompare(right.title);
      if (!left.storyDate) return 1;
      if (!right.storyDate) return -1;
      const comparison =
        new Date(left.storyDate).getTime() - new Date(right.storyDate).getTime();
      return sort.direction === "asc" ? comparison : -comparison;
    }

    const leftValue =
      sort.key === "story" ? left.title : statusLabel(left.status);
    const rightValue =
      sort.key === "story" ? right.title : statusLabel(right.status);
    const comparison = leftValue.localeCompare(rightValue, undefined, {
      sensitivity: "base",
    });
    return sort.direction === "asc" ? comparison : -comparison;
  });
}
