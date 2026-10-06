export type StoryVisibility = "PUBLIC" | "PRIVATE" | "GROUP";

export const storyVisibilityData = (
  visibility: StoryVisibility,
  visibilityGroupId?: string | null,
) => ({
  visibility,
  visibilityGroupId: visibility === "GROUP" ? visibilityGroupId || null : null,
  isPublic: visibility === "PUBLIC",
});

export const viewerStoryVisibilityWhere = (viewer?: {
  userId: string;
  volunteer: boolean;
} | null) => ({
  OR: [
    { visibility: "PUBLIC" as const },
    ...(viewer?.volunteer ? [{ visibility: "PRIVATE" as const }] : []),
    ...(viewer
      ? [{
          visibility: "GROUP" as const,
          visibilityGroup: { users: { some: { id: viewer.userId } } },
        }]
      : []),
  ],
});

export const groupingWhereForHarmony = (
  harmonyGroupId?: string | null,
) => harmonyGroupId
  ? { harmonyGroupId }
  : { id: { in: [] as string[] } };
