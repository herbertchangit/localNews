import { describe, expect, it } from "vitest";
import { registrationFieldSummaries } from "./registrationSummary";

describe("registration field summaries", () => {
  it("totals number and quantity answers selected for summary", () => {
    const summaries = registrationFieldSummaries(
      [
        { id: "tables", title: "Tables", type: "NUMBER", countInSummary: true },
        { id: "tickets", title: "Tickets", type: "CHECKBOX_QUANTITY", countInSummary: true, options: ["Adult", "Child"] },
        { id: "notes", title: "Notes", type: "TEXT", countInSummary: true },
      ],
      [
        { identity: "VOLUNTEER", customAnswers: { tables: 2, tickets: { Adult: 3, Child: 1 } } },
        { identity: "NON_VOLUNTEER", customAnswers: { tables: 4, tickets: { Adult: 2 } } },
      ],
    );

    expect(summaries).toEqual([
      { id: "tables", title: "Tables", total: 6, volunteers: 2, nonVolunteers: 4, breakdown: [] },
      {
        id: "tickets",
        title: "Tickets",
        total: 6,
        volunteers: 4,
        nonVolunteers: 2,
        breakdown: [
          { label: "Adult", total: 5, volunteers: 3, nonVolunteers: 2 },
          { label: "Child", total: 1, volunteers: 1, nonVolunteers: 0 },
        ],
      },
    ]);
  });
});
