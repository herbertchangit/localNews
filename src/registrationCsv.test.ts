import { describe, expect, it } from "vitest";
import {
  registrationCsv,
  registrationCsvFilename,
  registrationCsvTable,
} from "./registrationCsv";

const form = {
  eventName: "Community Day",
  description: "Welcome, everyone",
  eventDates: [
    { id: "date-2", eventDate: "2026-08-22T00:00:00.000Z" },
    { id: "date-1", eventDate: "2026-08-21T00:00:00.000Z" },
  ],
  customFields: [
    { id: "transport", title: "Transport" },
    { id: "skills", title: "Skills" },
  ],
  submissions: [
    {
      registrantName: "Chan, Mei",
      identity: "VOLUNTEER",
      contact: "0123456789",
      origin: "Puchong",
      createdAt: "2026-08-18T09:30:00.000Z",
      unregisteredAt: null,
      customAnswers: { transport: "Bus", skills: ["Food", "First aid"] },
      attendances: [
        {
          totalPersons: 2,
          meal: true,
          eventDate: {
            id: "date-1",
            eventDate: "2026-08-21T00:00:00.000Z",
          },
        },
      ],
    },
  ],
};

describe("registration CSV export", () => {
  it("exports standard, custom, and every event-date field in one row", () => {
    const { headers, rows } = registrationCsvTable(form);

    expect(headers).toContain("Transport");
    expect(headers).toContain("2026-08-21 Persons / 人数");
    expect(headers).toContain("2026-08-22 Meal / 用餐");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("Food, First aid");
    expect(rows[0]).toContain(2);
    expect(rows[0]).toContain("Yes / 是");
    expect(rows[0].slice(-3)).toEqual([
      "Registered / 已登记",
      "2026-08-18T09:30:00.000Z",
      "",
    ]);
  });

  it("creates an Excel-friendly, safely quoted CSV", () => {
    const csv = registrationCsv(form);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Welcome, everyone"');
    expect(csv).toContain('"Chan, Mei"');
  });

  it("creates a safe descriptive filename", () => {
    expect(registrationCsvFilename('Dinner: Group A/B')).toBe(
      "Dinner-Group-A-B-registrations.csv",
    );
  });
});
