import { describe, expect, it } from "vitest";
import { csvBoolean, parseCsv, toCsv } from "./userCsv";

describe("user CSV helpers", () => {
  it("parses quoted fields, escaped quotes and Windows line endings", () => {
    expect(parseCsv('\uFEFFname,email,labels\r\n"Chan, Mei",mei@example.com,"helper|""event lead"""\r\n')).toEqual([
      { name: "Chan, Mei", email: "mei@example.com", labels: 'helper|"event lead"' },
    ]);
  });

  it("exports values with CSV-safe quoting", () => {
    expect(toCsv(["name", "labels"], [["Chan, Mei", 'lead "A"']])).toBe(
      'name,labels\r\n"Chan, Mei","lead ""A"""',
    );
  });

  it("accepts common true values", () => {
    expect([csvBoolean("YES"), csvBoolean("1"), csvBoolean("false")]).toEqual([true, true, false]);
  });
});
