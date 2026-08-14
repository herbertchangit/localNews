import { describe, expect, it } from "vitest";
import { nextHierarchyAssignment } from "./accountHierarchy";

const assigned = {
  harmonyGroupId: "harmony-1",
  mutualLoveGroupId: "mutual-1",
  cooperationUnitId: "cooperation-1",
};

describe("inline account hierarchy changes", () => {
  it("clears MutualLove and Cooperation when Harmony changes", () => {
    expect(nextHierarchyAssignment(assigned, "harmony", "harmony-2")).toEqual({
      harmonyGroupId: "harmony-2",
      mutualLoveGroupId: null,
      cooperationUnitId: null,
    });
  });

  it("keeps Harmony and clears Cooperation when MutualLove changes", () => {
    expect(nextHierarchyAssignment(assigned, "mutualLove", "mutual-2")).toEqual({
      harmonyGroupId: "harmony-1",
      mutualLoveGroupId: "mutual-2",
      cooperationUnitId: null,
    });
  });

  it("changes only Cooperation when Cooperation changes", () => {
    expect(nextHierarchyAssignment(assigned, "cooperation", "cooperation-2")).toEqual({
      ...assigned,
      cooperationUnitId: "cooperation-2",
    });
  });
});
