import { describe, expect, it } from "vitest";
import {
  registrationFormWhereForHarmony,
  registrationSubmissionWhereForHarmony,
} from "./registrationHarmony";

describe("Registration Harmony scoping", () => {
  it("limits forms to creators in the logged-in user's Harmony", () => {
    expect(
      registrationFormWhereForHarmony({
        harmonyGroupId: "harmony-1",
        userId: "user-1",
      }),
    ).toEqual({ creator: { harmonyGroupId: "harmony-1" } });
  });

  it("falls back to forms created by the user when Harmony is unassigned", () => {
    expect(
      registrationFormWhereForHarmony({
        harmonyGroupId: null,
        userId: "user-1",
      }),
    ).toEqual({ creatorId: "user-1" });
  });

  it("applies the same scope through a registration submission's form", () => {
    expect(
      registrationSubmissionWhereForHarmony({
        harmonyGroupId: "harmony-1",
        userId: "user-1",
      }),
    ).toEqual({ form: { creator: { harmonyGroupId: "harmony-1" } } });
  });
});
