import { PrismaClient, Role } from "@prisma/client";
import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

export const MENU_DEFINITIONS = [
  { id: "photos", label: "Photos — Manually tagged photos", group: "Main menu" },
  { id: "overview", label: "Overview — Daily Brief", group: "Main menu" },
  { id: "stories", label: "Stories — Story CRUD", group: "Main menu" },
  { id: "people", label: "People", group: "Main menu" },
  { id: "registrations", label: "Registration", group: "Main menu" },
  { id: "talk_with_doc", label: "Talk With Doc", group: "Talk With Doc" },
  { id: "health_events", label: "Events", group: "Talk With Doc" },
  { id: "appointments", label: "Appointments", group: "Talk With Doc" },
  { id: "doctors", label: "Doctors", group: "Talk With Doc" },
  { id: "analytics", label: "Analytics", group: "Main menu" },
  { id: "settings", label: "Settings", group: "Settings" },
  { id: "settings_organizations", label: "Organizations", group: "Settings submenus" },
  { id: "settings_org_chart", label: "Organization Chart", group: "Settings submenus" },
  { id: "settings_areas", label: "Areas", group: "Settings submenus" },
  { id: "settings_categories", label: "News Categories", group: "Settings submenus" },
  { id: "settings_jingsi", label: "JingSi", group: "Settings submenus" },
  { id: "settings_languages", label: "Language Mapping", group: "Settings submenus" },
  { id: "settings_roles", label: "Roles", group: "Settings submenus" },
  { id: "logout", label: "Logout", group: "Account actions" },
  { id: "update_app", label: "Update App & Version", group: "Account actions" },
] as const;
export const ROLE_ACTIONS = ["new", "view", "edit", "delete", "publish", "unpublish", "reset_password", "lock_unlock", "suspend", "copy_link"] as const;

const menuIds = MENU_DEFINITIONS.map((item) => item.id);
const menuId = z.enum(menuIds as [string, ...string[]]);
const builtInRoles = new Set<string>(Object.values(Role));
const roleKey = z.string().trim().min(2).max(50).transform((value) =>
  value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
).refine((value) => value.length >= 2, "Enter a valid role name");
const authorityAction = z.enum(ROLE_ACTIONS);
const authorities = z.record(menuId, z.array(authorityAction));
const body = z.object({ role: roleKey, menuIds: z.array(menuId).max(menuIds.length), authorities });
type RequestWithUser = Request & { user?: { id: string; role: Role; roles?: Role[]; customRoles?: string[] } };
const effectiveRoles = (user: { role: Role; roles?: Role[] | null; customRoles?: string[] | null }) =>
  [...new Set([...(user.roles || []), user.role, ...(user.customRoles || [])])];
const profileKey = (profile: { role: Role | null; roleKey?: string | null }) => profile.roleKey || profile.role!;
const profileWhere = (roles: string[]) => ({
  OR: [
    { role: { in: roles.filter((value): value is Role => builtInRoles.has(value)) as Role[] } },
    { roleKey: { in: roles } },
  ],
});
const normalizedAuthorities = (profile: { authorities: unknown; menuIds: string[] } | null) => {
  if (!profile) return null;
  const saved = (profile.authorities || {}) as Record<string, string[]>;
  if (Object.keys(saved).length) return saved;
  return Object.fromEntries(MENU_DEFINITIONS.map((menu) => [menu.id, profile.menuIds.includes(menu.id) ? [...ROLE_ACTIONS] : []]));
};

export function createRoleMenuRouter(db: PrismaClient, secret: string) {
  const router = Router();
  const authenticate = (adminOnly = false) => (req: RequestWithUser, res: any, next: any) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Authentication required" });
      req.user = jwt.verify(token, secret) as { id: string; role: Role; roles?: Role[]; customRoles?: string[] };
      if (adminOnly && !effectiveRoles(req.user!).includes(Role.ADMIN) && !(req as any).roleAuthorityConfigured) return res.status(403).json({ error: "Administrator access required" });
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  router.get("/me", authenticate(), async (req: RequestWithUser, res) => {
    const current = await db.user.findUnique({ where: { id: req.user!.id }, select: { role: true, roles: true, customRoles: true } });
    if (!current) return res.status(404).json({ error: "User not found" });
    const roles = effectiveRoles(current);
    if (roles.includes(Role.ADMIN))
      return res.json({ role: current.role, roles, configured: false, menuIds: null, authorities: null });
    const profiles = await db.roleMenuAccess.findMany({ where: profileWhere(roles) });
    const menuIds = [...new Set(profiles.flatMap((profile) => profile.menuIds))];
    const combinedAuthorities: Record<string, string[]> = {};
    for (const profile of profiles) {
      const profileAuthorities = normalizedAuthorities(profile) || {};
      for (const [menu, actions] of Object.entries(profileAuthorities))
        combinedAuthorities[menu] = [...new Set([...(combinedAuthorities[menu] || []), ...actions])];
    }
    res.json({ role: current.role, roles, configured: profiles.length > 0, menuIds: profiles.length ? menuIds : null, authorities: profiles.length ? combinedAuthorities : null });
  });

  router.get("/admin", authenticate(true), async (_req, res) => {
    const profiles = await db.roleMenuAccess.findMany({ orderBy: [{ roleKey: "asc" }, { role: "asc" }] });
    const customRoles = profiles.filter((profile) => profile.roleKey).map(profileKey);
    res.json({ roles: [...Object.values(Role), ...customRoles], definitions: MENU_DEFINITIONS, actions: ROLE_ACTIONS, profiles: profiles.map((profile) => ({ ...profile, role: profileKey(profile), custom: Boolean(profile.roleKey), authorities: normalizedAuthorities(profile) })) });
  });

  router.post("/admin", authenticate(true), async (req: RequestWithUser, res) => {
    const data = body.parse(req.body);
    const isBuiltIn = builtInRoles.has(data.role);
    const duplicate = await db.roleMenuAccess.findFirst({ where: { OR: [{ roleKey: data.role }, ...(isBuiltIn ? [{ role: data.role as Role }] : [])] } });
    if (duplicate) return res.status(409).json({ error: "That role already exists" });
    const profile = await db.roleMenuAccess.create({ data: { role: isBuiltIn ? data.role as Role : null, roleKey: isBuiltIn ? null : data.role, menuIds: [...new Set(data.menuIds)], authorities: data.authorities } });
    await db.auditLog.create({ data: { action: "ROLE_MENU_CREATED", actorId: req.user!.id, metadata: { role: data.role, menuIds: profile.menuIds } } });
    res.status(201).json({ ...profile, role: profileKey(profile), custom: Boolean(profile.roleKey), authorities: normalizedAuthorities(profile) });
  });

  router.patch("/admin/:id", authenticate(true), async (req: RequestWithUser, res) => {
    const data = body.omit({ role: true }).partial().parse(req.body);
    const profile = await db.roleMenuAccess.update({ where: { id: String(req.params.id) }, data: { ...data, menuIds: data.menuIds ? [...new Set(data.menuIds)] : undefined } });
    await db.auditLog.create({ data: { action: "ROLE_MENU_UPDATED", actorId: req.user!.id, metadata: { role: profileKey(profile), menuIds: profile.menuIds } } });
    res.json({ ...profile, role: profileKey(profile), custom: Boolean(profile.roleKey), authorities: normalizedAuthorities(profile) });
  });

  router.delete("/admin/:id", authenticate(true), async (req: RequestWithUser, res) => {
    const existing = await db.roleMenuAccess.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) return res.status(404).json({ error: "Role access not found" });
    if (existing.roleKey) {
      const assignedUsers = await db.user.count({ where: { customRoles: { has: existing.roleKey } } });
      if (assignedUsers) return res.status(409).json({ error: `Remove this role from ${assignedUsers} user${assignedUsers === 1 ? "" : "s"} before deleting it` });
    }
    const profile = await db.roleMenuAccess.delete({ where: { id: existing.id } });
    await db.auditLog.create({ data: { action: "ROLE_MENU_RESET", actorId: req.user!.id, metadata: { role: profile.role } } });
    res.status(204).end();
  });

  return router;
}

export const routeMenu = (path: string, method = "GET") => {
  if (path === "/api/me/photos") return "photos";
  if (path.toLowerCase() === "/api/registrations/mine/check-in") return null;
  if (/^\/api\/(?:admin\/)?(?:accounts|users)|^\/api\/people\//.test(path)) return "people";
  if (method === "GET" && (/^\/api\/articles(?:\/[^/]+)?\/?$/.test(path) || /^\/api\/articles\/[^/]+\/discussion\/?$/.test(path))) return "overview";
  if (/^\/api\/(?:newsroom\/)?articles|^\/api\/editor\/articles/.test(path)) return "stories";
  if (/^\/api\/registrations\/mine(?:\/|$)/.test(path)) return "appointments";
  if (/^\/api\/registrations/.test(path)) return "registrations";
  if (/^\/api\/admin\/health\/events/.test(path)) return "health_events";
  if (/^\/api\/(?:admin|doctor)\/health\/appointments|^\/api\/health-events\/appointments/.test(path)) return "appointments";
  if (/^\/api\/admin\/health\/doctors|^\/api\/doctor\/health/.test(path)) return "doctors";
  if (/^\/api\/admin\/departments/.test(path)) return "settings_organizations";
  if (/^\/api\/admin\/(?:org-chart|org-structure|harmony-groups|mutual-love-groups|cooperation-units)/.test(path)) return "settings_org_chart";
  if (/^\/api\/admin\/areas/.test(path)) return "settings_areas";
  if (/^\/api\/admin\/categories/.test(path)) return "settings_categories";
  if (/^\/api\/admin\/jingsi/.test(path)) return "settings_jingsi";
  if (/^\/api\/admin\/languages/.test(path)) return "settings_languages";
  if (/^\/api\/role-menus\/admin/.test(path)) return "settings_roles";
  return null;
};
const routeAction = (req: Request) => {
  const path = req.path.toLowerCase();
  if (path.includes("reset-password")) return "reset_password";
  if (path.includes("unpublish")) return "unpublish";
  if (path.includes("republish") || (path.includes("/status") && req.body?.status === "PUBLISHED")) return "publish";
  if (req.method === "GET") return "view";
  if (req.method === "POST") return "new";
  if (req.method === "DELETE") return "delete";
  if (req.method === "PATCH" && Object.prototype.hasOwnProperty.call(req.body || {}, "locked")) return "lock_unlock";
  if (req.method === "PATCH" && Object.prototype.hasOwnProperty.call(req.body || {}, "suspended")) return "suspend";
  return "edit";
};

export function createRoleAuthorityMiddleware(db: PrismaClient, secret: string) {
  return async (req: Request, res: any, next: any) => {
    const menu = routeMenu(req.path, req.method);
    if (!menu) return next();
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return next();
      const payload = jwt.verify(token, secret) as { id: string };
      const current = await db.user.findUnique({ where: { id: payload.id }, select: { role: true, roles: true, customRoles: true } });
      if (!current) return next();
      const roles = effectiveRoles(current);
      if (roles.includes(Role.ADMIN)) return next();
      const profiles = await db.roleMenuAccess.findMany({ where: profileWhere(roles) });
      if (!profiles.length) return next();
      const menuIds = new Set(profiles.flatMap((profile) => profile.menuIds));
      const configured = profiles.reduce<Record<string, string[]>>((combined, profile) => {
        for (const [menuId, actions] of Object.entries(normalizedAuthorities(profile) || {}))
          combined[menuId] = [...new Set([...(combined[menuId] || []), ...actions])];
        return combined;
      }, {});
      (req as any).roleAuthorityConfigured = true;
      const action = routeAction(req);
      if (!menuIds.has(menu) || !configured[menu]?.includes(action)) return res.status(403).json({ error: `Role authority does not allow ${action.replaceAll("_", " ")} for this menu` });
      next();
    } catch {
      next();
    }
  };
}
