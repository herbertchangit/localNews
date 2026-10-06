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
