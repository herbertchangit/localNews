import { describe, expect, it } from "vitest";
import { findContactRegistration, findRegistrationConflicts } from "../server/registrationDuplicate";

describe("registration duplicate checking", () => {
  const submissions = [{
    registrantName: "Herbert Chan",
    contact: "012-639 9362",
    attendances: [
      { eventDateId: "date-one", eventDate: { eventDate: new Date("2026-08-21T00:00:00.000Z") } },
      { eventDateId: "date-two", eventDate: { eventDate: new Date("2026-08-22T00:00:00.000Z") } },
    ],
  }];

  it("prevents a duplicate date-free registration for the same contact", () => {
    const existing = [{ registrantName: "Existing User", contact: "+60123456789", attendances: [] }];
    expect(findContactRegistration(existing, "012-345 6789")?.registrantName).toBe("Existing User");
  });

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
