export type HierarchyAssignment = {
  harmonyGroupId: string | null;
  mutualLoveGroupId: string | null;
  cooperationUnitId: string | null;
};

export type HierarchyLevel = "harmony" | "mutualLove" | "cooperation";

export function nextHierarchyAssignment(
  current: HierarchyAssignment,
  level: HierarchyLevel,
  value: string,
): HierarchyAssignment {
  const next = { ...current };
  if (level === "harmony") {
    next.harmonyGroupId = value || null;
    next.mutualLoveGroupId = null;
    next.cooperationUnitId = null;
  } else if (level === "mutualLove") {
    next.mutualLoveGroupId = value || null;
    next.cooperationUnitId = null;
  } else next.cooperationUnitId = value || null;
  return next;
}
