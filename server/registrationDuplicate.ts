import { isContactMatch } from "./loginIdentifier.js";

type ExistingRegistration = {
  registrantName: string;
  contact: string;
  attendances: { eventDateId: string; eventDate: { eventDate: Date } }[];
};

export function findRegistrationConflicts(
  submissions: ExistingRegistration[],
  contact: string,
  selectedEventDateIds: string[],
) {
  const selected = new Set(selectedEventDateIds);
  return submissions.flatMap((submission) => {
    if (!isContactMatch(contact, submission.contact)) return [];
    const dates = submission.attendances
      .filter((attendance) => selected.has(attendance.eventDateId))
      .map((attendance) => attendance.eventDate.eventDate);
    return dates.length ? [{ registrantName: submission.registrantName, dates }] : [];
  });
}

export function findContactRegistration(
  submissions: ExistingRegistration[],
  contact: string,
) {
  return submissions.find((submission) => isContactMatch(contact, submission.contact));
}
