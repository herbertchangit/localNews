const ordinaryDefaults = new Set([
  "photos",
  "overview",
  "settings",
  "logout",
  "update_app",
]);
const editorialDefaults = new Set([
  "photos",
  "overview",
  "stories",
  "settings",
  "logout",
  "update_app",
]);
const medicalDefaults = new Set([
  "photos",
  "health_events",
  "doctors",
  "logout",
  "update_app",
]);

export const defaultMenusForRole = (role = ""): ReadonlySet<string> | null => {
  if (role === "ADMIN") return null;
  if (role === "ADMIN_MEDICAL") return medicalDefaults;
  if (["EDITOR", "REPORTER", "VOLUNTEER"].includes(role))
    return editorialDefaults;
  return ordinaryDefaults;
};
