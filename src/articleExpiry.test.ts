import { describe, expect, it } from "vitest";
import {
  ARTICLE_PUBLICATION_WINDOW_DAYS,
  articlePublicationCutoff,
  isArticlePublicationExpired,
} from "../server/articleExpiry";

describe("article publication expiry", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");

  it("expires a story published more than seven days ago", () => {
    expect(isArticlePublicationExpired("2026-07-30T11:59:59.999Z", now)).toBe(true);
  });

  it("keeps a story published for the full seven-day window", () => {
    expect(isArticlePublicationExpired("2026-07-30T12:00:00.000Z", now)).toBe(false);
    expect(isArticlePublicationExpired("2026-08-01T12:00:00.000Z", now)).toBe(false);
  });

  it("does not expire a legacy story without a publication date", () => {
    expect(isArticlePublicationExpired(null, now)).toBe(false);
  });

  it("calculates the same seven-day cutoff used by the database job", () => {
    expect(ARTICLE_PUBLICATION_WINDOW_DAYS).toBe(7);
    expect(articlePublicationCutoff(now).toISOString()).toBe("2026-07-30T12:00:00.000Z");
  });
});
