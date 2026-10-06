import { describe, expect, it } from "vitest";
import {
  areaWhereForHarmony,
  mutualLoveWhereForHarmony,
} from "./areaHarmony";

describe("Area Harmony scoping", () => {
  it("limits area rows through their MutualLove Harmony", () => {
    expect(areaWhereForHarmony("harmony-1")).toEqual({
      mutualLove: { harmonyId: "harmony-1" },
    });
  });

  it("limits MutualLove choices to the same Harmony", () => {
    expect(mutualLoveWhereForHarmony("harmony-1")).toEqual({
      harmonyId: "harmony-1",
    });
  });

  it("returns an empty scope for users without Harmony", () => {
    expect(areaWhereForHarmony(null)).toEqual({ id: { in: [] } });
    expect(mutualLoveWhereForHarmony(null)).toEqual({ id: { in: [] } });
  });
});
