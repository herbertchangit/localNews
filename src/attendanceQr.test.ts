import { describe, expect, it } from "vitest";
import { attendanceTokenFromQr, buildAttendanceQrUrl } from "./attendanceQr";

describe("registration attendance QR payload", () => {
  it("builds an appointment deep link and reads its signed token", () => {
    const link = buildAttendanceQrUrl("signed.token/value", "https://local.news/");
    expect(link).toBe(
      "https://local.news/newsroom/appointments?attendance=signed.token%2Fvalue",
    );
    expect(attendanceTokenFromQr(link)).toBe("signed.token/value");
  });

  it("accepts the compact scanner payload", () => {
    expect(attendanceTokenFromQr("local-news-attendance:abc.def")).toBe(
      "abc.def",
    );
  });

  it("rejects unrelated QR values", () => {
    expect(attendanceTokenFromQr("https://example.com/other?attendance=bad")).toBe(
      "",
    );
    expect(attendanceTokenFromQr("plain text")).toBe("");
  });
});
