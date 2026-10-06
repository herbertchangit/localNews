export const areaWhereForHarmony = (harmonyGroupId?: string | null) =>
  harmonyGroupId
    ? { mutualLove: { harmonyId: harmonyGroupId } }
    : { id: { in: [] as string[] } };

export const mutualLoveWhereForHarmony = (harmonyGroupId?: string | null) =>
  harmonyGroupId
    ? { harmonyId: harmonyGroupId }
    : { id: { in: [] as string[] } };
