import { describe, expect, it } from "vitest";
import { sortStories } from "./storySorting";

const stories = [
  { title: "Beta", status: "ARCHIVED", storyDate: "2026-11-03" },
  { title: "alpha", status: "PUBLISHED", storyDate: "2026-11-01" },
  { title: "No date", status: "DRAFT", storyDate: null },
];

describe("story list sorting", () => {
  it("sorts story titles and statuses in either direction", () => {
    expect(
      sortStories(stories, { key: "story", direction: "asc" }).map(
        (story) => story.title,
      ),
    ).toEqual(["alpha", "Beta", "No date"]);
    expect(
      sortStories(stories, { key: "status", direction: "desc" }).map(
        (story) => story.status,
      ),
    ).toEqual(["PUBLISHED", "ARCHIVED", "DRAFT"]);
  });

  it("sorts story dates while keeping missing dates last", () => {
    expect(
      sortStories(stories, { key: "storyDate", direction: "desc" }).map(
        (story) => story.title,
      ),
    ).toEqual(["Beta", "alpha", "No date"]);
    expect(
      sortStories(stories, { key: "storyDate", direction: "asc" }).map(
        (story) => story.title,
      ),
    ).toEqual(["alpha", "Beta", "No date"]);
  });
});
