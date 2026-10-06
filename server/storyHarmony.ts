export const newsroomStoryWhere = ({
  harmony,
  userId,
}: {
  harmony?: string | null;
  userId: string;
}) => {
  const normalizedHarmony = harmony?.trim();
  return normalizedHarmony ? { harmony: normalizedHarmony } : { authorId: userId };
};

export const viewerStoryWhere = (
  viewer?: { userId: string; harmony?: string | null } | null,
) => (viewer ? newsroomStoryWhere(viewer) : {});

export const overviewStoryWhere = (
  viewer?: { admin: boolean; harmony?: string | null } | null,
) => {
  if (!viewer || viewer.admin) return {};
  const harmony = viewer.harmony?.trim();
  return harmony ? { harmony } : { id: { in: [] as string[] } };
};
