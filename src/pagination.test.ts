import { describe, expect, it } from "vitest";
import { pageCount, paginate } from "./pagination";

describe("user management pagination", () => {
  const users = Array.from({ length: 31 }, (_, index) => index + 1);
  it("limits each page to 6 users", () => expect(paginate(users, 1)).toHaveLength(6));
  it("returns the remaining users on the last page", () => expect(paginate(users, 6)).toEqual([31]));
  it("calculates at least one page", () => { expect(pageCount(31)).toBe(6); expect(pageCount(0)).toBe(1); });
});
