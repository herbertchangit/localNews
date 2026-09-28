import { describe, expect, it } from "vitest";
import {
  cleanRegistrationOptionLines,
  splitRegistrationOptionLines,
} from "./registrationFieldOptions";

describe("registration field options", () => {
  it("preserves a trailing blank option while the user starts the next line", () => {
    expect(splitRegistrationOptionLines("Morning\n")).toEqual(["Morning", ""]);
  });

  it("cleans blank and duplicate options before saving", () => {
    expect(
      cleanRegistrationOptionLines([" Morning ", "", "Evening", "Morning"]),
    ).toEqual(["Morning", "Evening"]);
  });
});
