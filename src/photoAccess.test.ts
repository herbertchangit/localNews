import { describe, expect, it } from "vitest";
import { MENU_DEFINITIONS, routeMenu } from "../server/roleMenus";
describe("manual photo tag permissions", () => {
  it("exposes a distinct Photos permission", () => {
    expect(MENU_DEFINITIONS.filter(menu => menu.id === "photos")).toHaveLength(1);
    expect(routeMenu("/api/me/photos")).toBe("photos");
  });
  it("requires story authority to list and update tags", () => {
    const path = "/api/newsroom/articles/story/photos/photo/tags";
    expect(routeMenu(path, "GET")).toBe("stories");
    expect(routeMenu(path, "PATCH")).toBe("stories");
    expect(routeMenu("/api/newsroom/articles/story/photos/photo/tag-users", "GET")).toBe("stories");
  });
});
