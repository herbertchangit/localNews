import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  administratorUsesDefaultMenus,
  combinedMenuIdsForProfiles,
  routeMenu,
} from "../server/roleMenus";

describe("role menu request routing", () => {
  it("uses a saved Admin role profile instead of the unrestricted Admin fallback", () => {
    expect(administratorUsesDefaultMenus([Role.ADMIN], [])).toBe(true);
    expect(
      administratorUsesDefaultMenus(
        [Role.ADMIN],
        [{ role: Role.ADMIN }],
      ),
    ).toBe(false);
  });

  it("lets an assigned custom role govern Talk With Doc and Appointments visibility", () => {
    expect(
      combinedMenuIdsForProfiles(
        [
          {
            roleKey: null,
            menuIds: ["overview", "talk_with_doc", "appointments", "settings"],
          },
          { roleKey: "AREA_LEADER", menuIds: ["overview", "people"] },
        ],
        ["AREA_LEADER"],
      ),
    ).toEqual(["overview", "settings", "people"]);
  });

  it("combines explicitly enabled governed menus across multiple custom roles", () => {
    expect(
      combinedMenuIdsForProfiles(
        [
          { roleKey: "EVENT_HELPER", menuIds: ["appointments"] },
          { roleKey: "MEDICAL_HELPER", menuIds: ["talk_with_doc"] },
        ],
        ["EVENT_HELPER", "MEDICAL_HELPER"],
      ),
    ).toEqual(["appointments", "talk_with_doc"]);
  });

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
    expect(routeMenu("/api/registrations/mine/submissions/submission-id", "PATCH")).toBeNull();
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

  it("authorizes grouping CRUD through the Grouping settings submenu", () => {
    expect(routeMenu("/api/admin/groupings", "GET")).toBe("settings_grouping");
    expect(routeMenu("/api/admin/groupings/users", "GET")).toBe("settings_grouping");
    expect(routeMenu("/api/admin/groupings/group-id", "PATCH")).toBe("settings_grouping");
  });
});
