import { describe, expect, it } from "vitest";
import { routeMenu } from "../server/roleMenus";

describe("role menu request routing", () => {
  it("authorizes published story reads through Overview", () => {
    expect(routeMenu("/api/articles", "GET")).toBe("overview");
    expect(routeMenu("/api/articles/a-story", "GET")).toBe("overview");
    expect(routeMenu("/api/articles/story-id/discussion", "GET")).toBe("overview");
  });

  it("authorizes story management through Stories", () => {
    expect(routeMenu("/api/newsroom/articles", "GET")).toBe("stories");
    expect(routeMenu("/api/editor/articles", "GET")).toBe("stories");
    expect(routeMenu("/api/articles", "POST")).toBe("stories");
    expect(routeMenu("/api/articles/story-id/status", "PATCH")).toBe("stories");
  });

  it("authorizes a user's registration appointment changes through Appointments", () => {
    expect(routeMenu("/api/registrations/mine/check-in", "POST")).toBeNull();
    expect(routeMenu("/api/registrations/mine/attendance-id", "PATCH")).toBe(
      "appointments",
    );
    expect(routeMenu("/api/registrations/mine/attendance-id", "DELETE")).toBe(
      "appointments",
    );
    expect(routeMenu("/api/registrations/admin/forms", "GET")).toBe(
      "registrations",
    );
  });
});
