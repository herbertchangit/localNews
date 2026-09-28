import { describe, expect, it } from "vitest";
import { compatibleRegistrationAnswers } from "../server/registrationAnswerCompatibility";

describe("registration answer compatibility", () => {
  it("removes answers for options that no longer exist", () => {
    expect(
      compatibleRegistrationAnswers(
        [{ id: "meal", type: "CHECKBOX_QUANTITY", options: ["Yes"] }],
        { meal: { Yes: 2, OldOption: 4 } },
      ),
    ).toEqual({ meal: { Yes: 2 } });
  });

  it("preserves zero quantities for unchecked current options", () => {
    expect(
      compatibleRegistrationAnswers(
        [{ id: "meal", type: "CHECKBOX_QUANTITY", options: ["Yes", "No"] }],
        { meal: { Yes: 0, No: 2 } },
      ),
    ).toEqual({ meal: { Yes: 0, No: 2 } });
  });
});
