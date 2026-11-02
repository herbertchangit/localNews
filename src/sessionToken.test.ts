import { describe, expect, it } from "vitest";
import { sessionTokenExpired } from "./sessionToken";

const tokenWithExpiry = (expirySeconds: number) => {
  const payload = btoa(JSON.stringify({ exp: expirySeconds }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
};

describe("session token expiry", () => {
  it("accepts a session whose expiry is still in the future", () => {
    expect(sessionTokenExpired(tokenWithExpiry(200), 100_000)).toBe(false);
  });

  it("rejects expired and malformed sessions", () => {
    expect(sessionTokenExpired(tokenWithExpiry(100), 100_000)).toBe(true);
    expect(sessionTokenExpired("not-a-token", 100_000)).toBe(true);
  });
});
