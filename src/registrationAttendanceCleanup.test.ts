import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("registration attendance cleanup migration", () => {
  it("removes attendance rows before event-date rows", () => {
    const sql = fs.readFileSync(
      path.resolve("prisma/migrations/20260924000000_remove_registration_attendance_history/migration.sql"),
      "utf8",
    );
    expect(sql.indexOf('DELETE FROM "RegistrationAttendance"')).toBeGreaterThanOrEqual(0);
    expect(sql.indexOf('DELETE FROM "RegistrationEventDate"')).toBeGreaterThan(sql.indexOf('DELETE FROM "RegistrationAttendance"'));
  });
});
