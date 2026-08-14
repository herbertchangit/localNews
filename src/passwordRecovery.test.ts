import { describe, expect, it } from "vitest";
import { registeredNameMatches } from "../server/passwordRecovery";

describe("password recovery credential verification", () => {
  it("matches the registered full name without case sensitivity", () => {
    expect(registeredNameMatches("  carina   LEW ", "Carina Lew")).toBe(true);
  });

  it("rejects a different registered name", () => {
    expect(registeredNameMatches("Carina Lee", "Carina Lew")).toBe(false);
  });
});
