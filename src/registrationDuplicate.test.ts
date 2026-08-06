import { describe, expect, it } from "vitest";
import { findRegistrationConflicts } from "../server/registrationDuplicate";

describe("registration duplicate checking", () => {
  const submissions = [{
    registrantName: "Herbert Chan",
    contact: "012-639 9362",
    attendances: [
      { eventDateId: "date-one", eventDate: { eventDate: new Date("2026-08-21T00:00:00.000Z") } },
      { eventDateId: "date-two", eventDate: { eventDate: new Date("2026-08-22T00:00:00.000Z") } },
    ],
  }];

  it("finds the existing full name and overlapping date for an equivalent contact", () => {
    expect(findRegistrationConflicts(submissions, "+60 12 639-9362", ["date-two"])).toEqual([{
      registrantName: "Herbert Chan",
      dates: [new Date("2026-08-22T00:00:00.000Z")],
    }]);
  });

  it("allows the same contact to register for a different date", () => {
    expect(findRegistrationConflicts(submissions, "0126399362", ["date-three"])).toEqual([]);
  });

  it("allows a different contact to use the same date", () => {
    expect(findRegistrationConflicts(submissions, "0126399363", ["date-one"])).toEqual([]);
  });
});
