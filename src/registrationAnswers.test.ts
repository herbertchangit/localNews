import { describe, expect, it } from "vitest";
import { registrationAnswerText } from "./registrationAnswers";

describe("registration answer display", () => {
  it("formats option quantities clearly", () => {
    expect(registrationAnswerText({ Adult: 2, Child: 1 })).toBe(
      "Adult × 2, Child × 1",
    );
  });

  it("keeps regular checkbox answers unchanged", () => {
    expect(registrationAnswerText(["Bus", "Lunch"])).toBe("Bus, Lunch");
  });
});
