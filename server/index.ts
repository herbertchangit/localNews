// @ts-nocheck
import express from "express";
import cors from "cors";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  Role,
  ArticleStatus,
  ResponseCategory,
} from "@prisma/client";
import swaggerUi from "swagger-ui-express";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
dotenv.config();
import {
  createHealthAdminRouter,
  createHealthDoctorRouter,
  createHealthPublicRouter,
} from "./health.js";
import { createPasskeyRouter } from "./passkeys.js";
import {
  isContactMatch,
  loginEmailForContact,
  normalizeLoginContact,
} from "./loginIdentifier.js";
import { DEFAULT_PASSWORD, passwordChangeError } from "./passwordPolicy.js";
import { registeredNameMatches } from "./passwordRecovery.js";
import { createRegistrationRouter } from "./registration.js";
import { createReaderProfileRouter } from "./readerProfile.js";
import { createAreaRouter } from "./areas.js";
import {
  createRoleAuthorityMiddleware,
  createRoleMenuRouter,
} from "./roleMenus.js";
import { articlePublicationCutoff } from "./articleExpiry.js";
import {
  absoluteWebUrl,
  injectSocialMeta,
  plainText,
  storySocialUrl,
  youtubeThumbnailFromText,
} from "./socialPreview.js";
const app = express(),
  db = new PrismaClient(),
  secret = process.env.JWT_SECRET || "dev-only-secret-change-me",
  avatarDir = path.resolve("uploads");
app.set("trust proxy", 1);
const rawAuditCreate = db.auditLog.create.bind(db.auditLog);
db.auditLog.create = ((args: any) =>
  rawAuditCreate(JSON.parse(JSON.stringify(args)))) as any;
app.use(
  helmet({
    contentSecurityPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
app.use(cors());
app.use(express.json({ limit: "40mb" }));
const removeUploadFile = async (uploadUrl?: string | null) => {
  if (!uploadUrl?.startsWith("/uploads/")) return;
  const file = path.resolve(avatarDir, path.basename(uploadUrl));
  if (path.dirname(file) === avatarDir) await fs.unlink(file).catch(() => {});
};
const saveImage = async (
  prefix: string,
  dataUrl: string,
  previous: string | null | undefined,
  maxBytes: number,
) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl,
  );
  if (!match) throw new Error("Only PNG, JPEG, or WebP photos are allowed");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > maxBytes)
    throw new Error(
      `Photo must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller`,
    );
  await fs.mkdir(avatarDir, { recursive: true });
  const ext = match[1] === "jpeg" ? "jpg" : match[1],
    name = `${prefix}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(avatarDir, name), bytes);
  await removeUploadFile(previous);
  return `/uploads/${name}`;
};
const removeAvatarFile = removeUploadFile;
const saveAvatar = (
  userId: string,
  dataUrl: string,
  previous?: string | null,
) => saveImage(userId, dataUrl, previous, 2 * 1024 * 1024);
type Req = express.Request & {
  user?: { id: string; role: Role; roles?: Role[]; customRoles?: string[] };
  roleAuthorityConfigured?: boolean;
};
const rolePriority = [
  Role.ADMIN,
  Role.ADMIN_MEDICAL,
  Role.EDITOR,
  Role.DOCTOR,
  Role.REPORTER,
  Role.VOLUNTEER,
  Role.DADE,
  Role.AUDIENCE,
];
const effectiveRoles = (user: { role: Role; roles?: Role[] | null; customRoles?: string[] | null }) =>
  [...new Set([...(user.roles || []), user.role, ...(user.customRoles || [])])];
const primaryRole = (roles: Role[]) =>
  rolePriority.find((role) => roles.includes(role)) || roles[0] || Role.DADE;
const auth =
  (roles?: Role[]) =>
  (req: Req, res: express.Response, next: express.NextFunction) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token)
        return res.status(401).json({ error: "Authentication required" });
      req.user = jwt.verify(token, secret) as any;
      if (
        roles &&
        !effectiveRoles(req.user!).some((role) => roles.includes(role)) &&
        !req.roleAuthorityConfigured
      )
        return res.status(403).json({ error: "Insufficient permission" });
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
const optionalAuth = (
  req: Req,
  _res: express.Response,
  next: express.NextFunction,
) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token)
    try {
      req.user = jwt.verify(token, secret) as any;
    } catch {}
  next();
};
const canCreateStory = async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, department: { select: { name: true } } },
  });
  if (!user) return false;
  const profile = await db.roleMenuAccess.findUnique({ where: { role: user.role } });
  const configured = (profile?.authorities || {}) as Record<string, string[]>;
  if (profile)
    return profile.menuIds.includes("stories") && (!Object.keys(configured).length || Boolean(configured.stories?.includes("new")));
  return user.role === Role.ADMIN || user.department?.name === "Humanistic Mission" || user.department?.name === "人文志業";
};
app.use(createRoleAuthorityMiddleware(db, secret));
const saveStoryMedia = async (prefix: string, dataUrl: string) => {
  const match =
    /^data:(image|video)\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(
      dataUrl,
    );
  if (!match) throw new Error("Use PNG, JPEG, WebP, MP4, WebM or MOV files");
  const kind = match[1].toLowerCase(),
    subtype = match[2].toLowerCase(),
    isVideo = kind === "video",
    allowed = isVideo ? ["mp4", "webm", "quicktime"] : ["png", "jpeg", "webp"];
  if (!allowed.includes(subtype))
    throw new Error("Use PNG, JPEG, WebP, MP4, WebM or MOV files");
  const maxBytes = isVideo ? 25 * 1024 * 1024 : 5 * 1024 * 1024,
    bytes = Buffer.from(match[3], "base64");
  if (!bytes.length || bytes.length > maxBytes)
    throw new Error(
      `${isVideo ? "Video" : "Photo"} must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller`,
    );
  await fs.mkdir(avatarDir, { recursive: true });
  const ext =
      subtype === "jpeg" ? "jpg" : subtype === "quicktime" ? "mov" : subtype,
    name = `${prefix}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(avatarDir, name), bytes);
  return { url: `/uploads/${name}`, isVideo };
};
const isVideoUploadUrl = (url: string) => /\.(mov|mp4|webm)$/i.test(url);
app.use("/uploads", express.static(avatarDir));
const avatarBody = z.object({ dataUrl: z.string().max(3_000_000) });
app.get("/api/me/avatar", auth(), async (q: Req, r) => {
  const user = await db.user.findUnique({
    where: { id: q.user!.id },
    select: { avatarUrl: true },
  });
  user ? r.json(user) : r.status(404).json({ error: "User not found" });
});
app.post("/api/me/avatar", auth(), async (q: Req, r) => {
  try {
    const { dataUrl } = avatarBody.parse(q.body),
      current = await db.user.findUnique({
        where: { id: q.user!.id },
        select: { avatarUrl: true },
      });
    if (!current) return r.status(404).json({ error: "User not found" });
    const avatarUrl = await saveAvatar(q.user!.id, dataUrl, current.avatarUrl);
    await db.user.update({ where: { id: q.user!.id }, data: { avatarUrl } });
    await db.auditLog.create({
      data: { action: "PROFILE_PHOTO_UPDATED", actorId: q.user!.id },
    });
    r.json({ avatarUrl });
  } catch (e: any) {
    r.status(400).json({ error: e?.message || "Could not upload photo" });
  }
});
app.delete("/api/me/avatar", auth(), async (q: Req, r) => {
  const current = await db.user.findUnique({
    where: { id: q.user!.id },
    select: { avatarUrl: true },
  });
  if (!current) return r.status(404).json({ error: "User not found" });
  await removeAvatarFile(current.avatarUrl);
  await db.user.update({
    where: { id: q.user!.id },
    data: { avatarUrl: null },
  });
  await db.auditLog.create({
    data: { action: "PROFILE_PHOTO_REMOVED", actorId: q.user!.id },
  });
  r.status(204).end();
});
app.get("/api/admin/avatars", auth([Role.ADMIN]), async (_q, r) =>
  r.json(await db.user.findMany({ select: { id: true, avatarUrl: true } })),
);
app.post(
  "/api/admin/accounts/:id/avatar",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    try {
      const { dataUrl } = avatarBody.parse(q.body),
        current = await db.user.findUnique({
          where: { id: q.params.id },
          select: { avatarUrl: true },
        });
      if (!current) return r.status(404).json({ error: "User not found" });
      const avatarUrl = await saveAvatar(
        q.params.id,
        dataUrl,
        current.avatarUrl,
      );
      await db.user.update({ where: { id: q.params.id }, data: { avatarUrl } });
      await db.auditLog.create({
        data: {
          action: "USER_PHOTO_UPDATED",
          actorId: q.user!.id,
          metadata: { userId: q.params.id },
        },
      });
      r.json({ avatarUrl });
    } catch (e: any) {
      r.status(400).json({ error: e?.message || "Could not upload photo" });
    }
  },
);
app.delete(
  "/api/admin/accounts/:id/avatar",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const current = await db.user.findUnique({
      where: { id: q.params.id },
      select: { avatarUrl: true },
    });
    if (!current) return r.status(404).json({ error: "User not found" });
    await removeAvatarFile(current.avatarUrl);
    await db.user.update({
      where: { id: q.params.id },
      data: { avatarUrl: null },
    });
    await db.auditLog.create({
      data: {
        action: "USER_PHOTO_REMOVED",
        actorId: q.user!.id,
        metadata: { userId: q.params.id },
      },
    });
    r.status(204).end();
  },
);
app.get("/api/health", (_q, r) => r.json({ status: "ok" }));
const loginUserSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    roles: true,
    customRoles: true,
    avatarUrl: true,
    password: true,
    locked: true,
    suspended: true,
    updatedAt: true,
  },
  sessionFor = (user: any) => ({
    token: jwt.sign({ id: user.id, role: user.role, roles: effectiveRoles(user), customRoles: user.customRoles || [] }, secret, {
      expiresIn: "8h",
    }),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roles: effectiveRoles(user),
      customRoles: user.customRoles || [],
      avatarUrl: user.avatarUrl,
    },
  });
const findLoginUser = async (identifier: string) => {
  let user = identifier.includes("@")
    ? await db.user.findUnique({
        where: { email: identifier.toLowerCase() },
        select: loginUserSelect,
      })
    : null;
  if (!user && !identifier.includes("@")) {
    const candidates = await db.user.findMany({
        where: { phone: { not: null } },
        select: loginUserSelect,
      }),
      matches = candidates.filter((candidate) =>
        isContactMatch(identifier, candidate.phone),
      );
    if (matches.length === 1) user = matches[0];
  }
  return user;
};
app.post("/api/auth/login", async (q, r) => {
  const body = z
      .object({
        identifier: z.string().trim().min(3).max(254).optional(),
        email: z.string().trim().optional(),
        password: z.string().default(""),
      })
      .refine((value) => Boolean(value.identifier || value.email))
      .parse(q.body),
    identifier = (body.identifier || body.email || "").trim();
  const user = await findLoginUser(identifier);
  if (!user || user.locked || user.suspended)
    return r
      .status(401)
      .json({ error: "Invalid credentials or inactive account" });
  if (!body.password && (await bcrypt.compare(DEFAULT_PASSWORD, user.password)))
    return r.json({
      requiresPasswordChange: true,
      passwordChangeToken: jwt.sign(
        { id: user.id, scope: "password-change" },
        secret,
        { expiresIn: "15m" },
      ),
      user: { name: user.name },
    });
  if (!body.password || !(await bcrypt.compare(body.password, user.password)))
    return r
      .status(401)
      .json({ error: "Invalid credentials or inactive account" });
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  r.json(sessionFor(user));
});
const passwordRecoveryAttempts = new Map<
  string,
  { count: number; resetAt: number }
>();
app.post("/api/auth/forgot-password/verify", async (q, r) => {
  const body = z
      .object({
        identifier: z.string().trim().min(3).max(254),
        fullName: z.string().trim().min(2).max(80),
      })
      .parse(q.body),
    attemptKey = `${q.ip}:${body.identifier.toLowerCase()}`,
    now = Date.now(),
    previous = passwordRecoveryAttempts.get(attemptKey);
  if (previous && previous.resetAt > now && previous.count >= 5)
    return r.status(429).json({
      error: "Too many recovery attempts. Please wait 15 minutes and try again.",
    });
  if (!previous || previous.resetAt <= now)
    passwordRecoveryAttempts.set(attemptKey, {
      count: 0,
      resetAt: now + 15 * 60 * 1000,
    });
  const user = await findLoginUser(body.identifier),
    valid =
      user &&
      !user.locked &&
      !user.suspended &&
      registeredNameMatches(body.fullName, user.name);
  if (!valid) {
    const attempt = passwordRecoveryAttempts.get(attemptKey)!;
    attempt.count += 1;
    return r.status(401).json({
      error: "The registered credential and full name could not be verified.",
    });
  }
  passwordRecoveryAttempts.delete(attemptKey);
  r.json({
    passwordResetToken: jwt.sign(
      {
        id: user.id,
        scope: "password-reset",
        accountVersion: user.updatedAt.getTime(),
      },
      secret,
      { expiresIn: "10m" },
    ),
    user: { name: user.name },
  });
});
app.post("/api/auth/forgot-password/reset", async (q, r) => {
  try {
    const body = z
        .object({
          passwordResetToken: z.string().min(1),
          newPassword: z.string(),
          confirmPassword: z.string(),
        })
        .parse(q.body),
      payload = jwt.verify(body.passwordResetToken, secret) as {
        id: string;
        scope?: string;
        accountVersion?: number;
      };
    if (payload.scope !== "password-reset")
      return r.status(401).json({ error: "Invalid password reset request" });
    const policyError = passwordChangeError(
      body.newPassword,
      body.confirmPassword,
    );
    if (policyError) return r.status(400).json({ error: policyError });
    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: loginUserSelect,
    });
    if (
      !user ||
      user.locked ||
      user.suspended ||
      user.updatedAt.getTime() !== payload.accountVersion
    )
      return r.status(401).json({ error: "Password reset request has expired" });
    await db.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(body.newPassword, 12) },
    });
    await db.auditLog.create({
      data: { action: "PASSWORD_SELF_RESET", actorId: user.id },
    });
    r.json({ message: "Password reset successful" });
  } catch (error: any) {
    r.status(error?.name === "ZodError" ? 400 : 401).json({
      error:
        error?.name === "ZodError"
          ? "Invalid request"
          : "Password reset request has expired",
    });
  }
});
app.post("/api/auth/change-default-password", async (q, r) => {
  try {
    const body = z
        .object({
          passwordChangeToken: z.string().min(1),
          newPassword: z.string(),
          confirmPassword: z.string(),
        })
        .parse(q.body),
      payload = jwt.verify(body.passwordChangeToken, secret) as {
        id: string;
        scope?: string;
      };
    if (payload.scope !== "password-change")
      return r.status(401).json({ error: "Invalid password change request" });
    const policyError = passwordChangeError(
      body.newPassword,
      body.confirmPassword,
    );
    if (policyError) return r.status(400).json({ error: policyError });
    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: loginUserSelect,
    });
    if (
      !user ||
      user.locked ||
      user.suspended ||
      !(await bcrypt.compare(DEFAULT_PASSWORD, user.password))
    )
      return r
        .status(401)
        .json({ error: "Password change request has expired" });
    await db.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(body.newPassword, 12),
        lastLoginAt: new Date(),
      },
    });
    await db.auditLog.create({
      data: { action: "DEFAULT_PASSWORD_CHANGED", actorId: user.id },
    });
    r.json(sessionFor(user));
  } catch (error: any) {
    r.status(error?.name === "ZodError" ? 400 : 401).json({
      error:
        error?.name === "ZodError"
          ? "Invalid request"
          : "Password change request has expired",
    });
  }
});
app.post("/api/auth/register", async (q, r) => {
  const body = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .email()
          .or(z.literal(""))
          .optional()
          .default(""),
        contact: z.string().trim().min(7).max(40),
        stayArea: z.string().trim().min(2).max(120),
        password: z.string(),
        confirmPassword: z.string(),
      })
      .parse(q.body),
    policyError = passwordChangeError(body.password, body.confirmPassword),
    email = body.email || loginEmailForContact(body.contact);
  if (!email)
    return r
      .status(400)
      .json({ error: "Enter a valid contact number with at least 7 digits" });
  if (policyError) return r.status(400).json({ error: policyError });
  if (await db.user.findUnique({ where: { email } }))
    return r.status(409).json({ error: "That email is already registered" });
  const contactUsers = await db.user.findMany({
    where: { phone: { not: null } },
    select: { phone: true },
  });
  if (contactUsers.some((user) => isContactMatch(body.contact, user.phone)))
    return r
      .status(409)
      .json({ error: "That contact number is already registered" });
  const user = await db.user.create({
    data: {
      name: body.name,
      email,
      phone: body.contact,
      stayArea: body.stayArea,
      password: await bcrypt.hash(body.password, 12),
      role: Role.DADE,
      roles: [Role.DADE],
      lastLoginAt: new Date(),
    },
    select: { id: true, name: true, email: true, role: true, roles: true, avatarUrl: true },
  });
  await db.auditLog.create({
    data: {
      action: "READER_REGISTERED",
      actorId: user.id,
      metadata: {
        email: user.email,
        contact: body.contact,
        stayArea: body.stayArea,
        role: user.role,
      },
    },
  });
  const token = jwt.sign({ id: user.id, role: user.role, roles: effectiveRoles(user), customRoles: user.customRoles || [] }, secret, {
    expiresIn: "8h",
  });
  r.status(201).json({ token, user });
});
app.use("/api/passkeys", createPasskeyRouter(db, secret, auth()));
app.use("/api/admin/health", createHealthAdminRouter(db, secret));
app.use("/api/doctor/health", createHealthDoctorRouter(db, secret));
app.use("/api/health-events", createHealthPublicRouter(db, secret));
const facebookPreviewHost = (hostname: string) =>
  hostname === "facebook.com" ||
  hostname.endsWith(".facebook.com") ||
  hostname === "fb.watch";
const decodeHtmlAttribute = (value: string) =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x2f;/gi, "/");
const openGraphValue = (html: string, keys: string[]) => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gis))
      attributes[match[1].toLowerCase()] = decodeHtmlAttribute(match[3]);
    const key = (attributes.property || attributes.name || "").toLowerCase();
    if (keys.includes(key) && attributes.content) return attributes.content;
  }
  return null;
};
const openGraphImage = (html: string) =>
  openGraphValue(html, ["og:image", "og:image:url", "twitter:image"]);
app.get("/api/link-preview/image", async (q, r) => {
  try {
    const value = typeof q.query.url === "string" ? q.query.url : "",
      url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !facebookPreviewHost(url.hostname.toLowerCase())
    )
      return r
        .status(400)
        .json({ error: "Only Facebook preview URLs are supported" });
    const page = await fetch(url, {
      headers: {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!page.ok)
      return r.status(404).json({ error: "Facebook preview is unavailable" });
    const imageValue = openGraphImage((await page.text()).slice(0, 2_000_000));
    if (!imageValue)
      return r
        .status(404)
        .json({ error: "Facebook preview image was not found" });
    const imageUrl = new URL(imageValue);
    if (!["http:", "https:"].includes(imageUrl.protocol))
      return r
        .status(404)
        .json({ error: "Facebook preview image was invalid" });
    r.set("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    r.redirect(302, imageUrl.href);
  } catch {
    r.status(404).json({ error: "Facebook preview is unavailable" });
  }
});
app.get("/api/link-preview/facebook-embed", async (q, r) => {
  try {
    const value = typeof q.query.url === "string" ? q.query.url : "",
      url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !facebookPreviewHost(url.hostname.toLowerCase())
    )
      return r.status(400).json({ error: "Only Facebook URLs are supported" });
    let canonical = url;
    try {
      const page = await fetch(url, {
        headers: {
          "User-Agent":
            "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (page.ok) {
        const canonicalValue = openGraphValue(
          (await page.text()).slice(0, 2_000_000),
          ["og:url"],
        );
        if (canonicalValue) {
          const resolved = new URL(canonicalValue);
          if (
            ["http:", "https:"].includes(resolved.protocol) &&
            facebookPreviewHost(resolved.hostname.toLowerCase())
          )
            canonical = resolved;
        }
      }
    } catch {}
    const plugin =
        /\/(?:reel|videos?)\//i.test(canonical.pathname) ||
        canonical.hostname.toLowerCase() === "fb.watch"
          ? "video.php"
          : "post.php",
      embed = new URL(`https://www.facebook.com/plugins/${plugin}`);
    embed.searchParams.set("href", canonical.href);
    embed.searchParams.set("show_text", "false");
    embed.searchParams.set("width", "1000");
    r.set("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    r.redirect(302, embed.href);
  } catch {
    r.status(404).json({ error: "Facebook content is unavailable" });
  }
});
app.get("/api/categories", async (_q, r) =>
  r.json(
    await db.category.findMany({
      where: { archived: false },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ),
);
app.get("/api/story-options", auth(), async (q: Req, r) =>
  r.json({
    canCreate: await canCreateStory(q.user!.id),
    categories: await db.category.findMany({
      where: { archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  }),
);
const jingSiInput = z.object({ content: z.string().trim().min(2).max(500) });
app.get("/api/jingsi/current", async (_q, r) => {
  r.set("Cache-Control", "no-store");
  const message = await db.jingSiMessage.findFirst({
    orderBy: { createdAt: "desc" },
  });
  message
    ? r.json(message)
    : r.status(404).json({ error: "No JingSi message available" });
});
app.get("/api/admin/jingsi", auth([Role.ADMIN]), async (_q, r) =>
  r.json(await db.jingSiMessage.findMany({ orderBy: { createdAt: "desc" } })),
);
app.post("/api/admin/jingsi", auth([Role.ADMIN]), async (q: Req, r) => {
  const data = jingSiInput.parse(q.body),
    message = await db.jingSiMessage.create({ data });
  await db.auditLog.create({
    data: {
      action: "JINGSI_CREATED",
      actorId: q.user!.id,
      metadata: { messageId: message.id },
    },
  });
  r.status(201).json(message);
});
app.patch("/api/admin/jingsi/:id", auth([Role.ADMIN]), async (q: Req, r) => {
  const data = jingSiInput.partial().parse(q.body),
    message = await db.jingSiMessage.update({
      where: { id: q.params.id },
      data,
    });
  await db.auditLog.create({
    data: {
      action: "JINGSI_UPDATED",
      actorId: q.user!.id,
      metadata: { messageId: message.id },
    },
  });
  r.json(message);
});
app.delete("/api/admin/jingsi/:id", auth([Role.ADMIN]), async (q: Req, r) => {
  if ((await db.jingSiMessage.count()) <= 1)
    return r
      .status(409)
      .json({ error: "At least one JingSi message must remain" });
  const message = await db.jingSiMessage.delete({ where: { id: q.params.id } });
  await db.auditLog.create({
    data: {
      action: "JINGSI_DELETED",
      actorId: q.user!.id,
      metadata: { messageId: message.id },
    },
  });
  r.status(204).end();
});
const translationInput = z.object({
  source: z.string().trim().min(1).max(500),
  zhCn: z.string().trim().min(1).max(1000),
  zhTw: z.string().trim().min(1).max(1000),
});
app.get("/api/translations", async (_q, r) => {
  r.set("Cache-Control", "no-store");
  r.json(await db.translationMapping.findMany({ orderBy: { source: "asc" } }));
});
app.get("/api/admin/translations", auth([Role.ADMIN]), async (_q, r) =>
  r.json(await db.translationMapping.findMany({ orderBy: { source: "asc" } })),
);
app.post("/api/admin/translations", auth([Role.ADMIN]), async (q: Req, r) => {
  const data = translationInput.parse(q.body),
    mapping = await db.translationMapping.upsert({
      where: { source: data.source },
      create: data,
      update: { zhCn: data.zhCn, zhTw: data.zhTw },
    });
  await db.auditLog.create({
    data: {
      action: "TRANSLATION_UPDATED",
      actorId: q.user!.id,
      metadata: { source: data.source },
    },
  });
  r.json(mapping);
});
app.delete("/api/admin/translations", auth([Role.ADMIN]), async (q: Req, r) => {
  const { source } = z
    .object({ source: z.string().trim().min(1).max(500) })
    .parse(q.body);
  await db.translationMapping.deleteMany({ where: { source } });
  await db.auditLog.create({
    data: {
      action: "TRANSLATION_RESET",
      actorId: q.user!.id,
      metadata: { source },
    },
  });
  r.status(204).end();
});
const newsroomRoles = [Role.ADMIN, Role.EDITOR, Role.REPORTER, Role.VOLUNTEER];
const hasFullStoryAccess = (role: Role) =>
  role === Role.ADMIN || role === Role.EDITOR;
const hasConfiguredStoryAccess = (q: Req) => Boolean(q.roleAuthorityConfigured);
const canViewPrivateStories = (role?: Role) =>
  !!role && role !== Role.DADE && role !== Role.AUDIENCE;
const publishedVisibility = (q: Req) =>
  canViewPrivateStories(q.user?.role) ? {} : { isPublic: true };
const storyMediaLimit = (role: Role) => (hasFullStoryAccess(role) ? 100 : 12);
const canEditArticle = (q: Req, article: { authorId: string }) =>
  hasConfiguredStoryAccess(q) || hasFullStoryAccess(q.user!.role) || article.authorId === q.user!.id;
const articleInclude = {
  author: { select: { name: true } },
  category: true,
  photos: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  },
};
const richTextOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    div: "p",
    a: (_tagName: string, attributes: Record<string, string>) => ({
      tagName: "a",
      attribs: { ...attributes, target: "_blank", rel: "noopener noreferrer" },
    }),
  },
};
const sanitizeRichText = (value: string) =>
  sanitizeHtml(value, richTextOptions).trim();
const richTextLength = (value: string) =>
  sanitizeHtml(
    value
      .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, " "),
    { allowedTags: [], allowedAttributes: {} },
  )
    .replace(/\s+/g, " ")
    .trim().length;
const richTextField = (minimum: number, maximum?: number) =>
  z
    .string()
    .transform(sanitizeRichText)
    .refine((value) => richTextLength(value) >= minimum, {
      message: `Must contain at least ${minimum} characters`,
    })
    .refine(
      (value) => maximum === undefined || richTextLength(value) <= maximum,
      {
        message:
          maximum === undefined
            ? "Invalid rich text"
            : `Must contain no more than ${maximum} characters`,
      },
    );
const storyDateField = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
  .optional()
  .transform((value) => (value ? new Date(`${value}T12:00:00.000Z`) : value));
const newsroomArticleInput = z.object({
  title: z.string().trim().min(8).max(180).optional(),
  excerpt: richTextField(10, 600).optional(),
  content: richTextField(20).optional(),
  categoryId: z.string().optional(),
  storyDate: storyDateField,
  isPublic: z.boolean().optional(),
});
const storyImageBody = z.object({
  dataUrl: z.string().max(7_500_000),
  caption: z.string().trim().max(240).optional().default(""),
});
const storyMediaBody = z.object({
  dataUrl: z.string().max(35_000_000),
  caption: z.string().trim().max(240).optional().default(""),
});
const storyPhotoUpdate = z.object({ caption: z.string().trim().max(240) });
const storyPhotoOrderBody = z.object({
  photoIds: z
    .array(z.string())
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Media order cannot contain duplicate items",
    }),
});
const reviewChanges = (q: Req, status: ArticleStatus) =>
  !hasConfiguredStoryAccess(q) && !hasFullStoryAccess(q.user!.role) && status === ArticleStatus.PUBLISHED;
const expirePublishedArticles = async (now = new Date()) => {
  const cutoff = articlePublicationCutoff(now),
    expired = await db.article.findMany({
      where: { status: ArticleStatus.PUBLISHED, publishedAt: { lt: cutoff } },
      select: { id: true },
    });
  if (!expired.length) return 0;
  const ids = expired.map((article) => article.id),
    result = await db.article.updateMany({
      where: { id: { in: ids }, status: ArticleStatus.PUBLISHED },
      data: { status: ArticleStatus.ARCHIVED, isHeadline: false },
    });
  if (result.count)
    await db.auditLog.create({
      data: {
        action: "ARTICLES_AUTO_UNPUBLISHED",
        metadata: {
          articleIds: ids,
          cutoff: cutoff.toISOString(),
          reason: "SEVEN_DAY_PUBLICATION_LIMIT",
        },
      },
    });
  return result.count;
};
app.get("/api/newsroom/articles", auth(newsroomRoles), async (q: Req, r) => {
  await expirePublishedArticles();
  r.json(
    await db.article.findMany({
      where: hasConfiguredStoryAccess(q) || hasFullStoryAccess(q.user!.role) ? {} : { authorId: q.user!.id },
      include: articleInclude,
      orderBy: { updatedAt: "desc" },
    }),
  );
});
app.get(
  "/api/newsroom/articles/:id",
  auth(newsroomRoles),
  async (q: Req, r) => {
    const article = await db.article.findUnique({
      where: { id: q.params.id },
      include: articleInclude,
    });
    if (!article) return r.status(404).json({ error: "Story not found" });
    if (!canEditArticle(q, article))
      return r
        .status(403)
        .json({ error: "You can only preview your own stories" });
    r.json(article);
  },
);
app.patch(
  "/api/newsroom/articles/:id",
  auth(newsroomRoles),
  async (q: Req, r) => {
    const current = await db.article.findUnique({
      where: { id: q.params.id },
      select: { id: true, authorId: true, status: true },
    });
    if (!current) return r.status(404).json({ error: "Story not found" });
    if (!canEditArticle(q, current))
      return r
        .status(403)
        .json({ error: "You can only edit your own stories" });
    const changes = newsroomArticleInput.parse(q.body);
    if (changes.isPublic !== undefined && !hasConfiguredStoryAccess(q) && !hasFullStoryAccess(q.user!.role))
      return r
        .status(403)
        .json({
          error: "Only administrators and editors can change public visibility",
        });
    const requiresReview = reviewChanges(q, current.status);
    const article = await db.article.update({
      where: { id: current.id },
      data: {
        ...changes,
        status: requiresReview ? ArticleStatus.REVIEW : undefined,
        publishedAt: requiresReview ? null : undefined,
        isHeadline:
          requiresReview || changes.isPublic === false ? false : undefined,
      },
      include: articleInclude,
    });
    await db.auditLog.create({
      data: {
        action: "ARTICLE_UPDATED",
        actorId: q.user!.id,
        metadata: {
          articleId: article.id,
          changes: Object.keys(changes),
          requiresReview,
        },
      },
    });
    r.json(article);
  },
);
app.delete(
  "/api/newsroom/articles/:id",
  auth([Role.ADMIN, Role.EDITOR]),
  async (q: Req, r) => {
    const article = await db.article.findUnique({
      where: { id: q.params.id },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        photos: { select: { url: true } },
      },
    });
    if (!article) return r.status(404).json({ error: "Story not found" });
    await db.$transaction([
      db.comment.deleteMany({ where: { articleId: article.id } }),
      db.article.delete({ where: { id: article.id } }),
    ]);
    await Promise.all(
      [
        ...new Set(
          [
            article.imageUrl,
            ...article.photos.map((photo) => photo.url),
          ].filter(Boolean),
        ),
      ].map(removeUploadFile),
    );
    await db.auditLog.create({
      data: {
        action: "ARTICLE_DELETED",
        actorId: q.user!.id,
        metadata: { articleId: article.id, title: article.title },
      },
    });
    r.status(204).end();
  },
);
app.post(
  "/api/newsroom/articles/:id/photos",
  auth(newsroomRoles),
  async (q: Req, r) => {
    try {
      const { dataUrl, caption } = storyMediaBody.parse(q.body),
        current = await db.article.findUnique({
          where: { id: q.params.id },
          select: {
            id: true,
            authorId: true,
            status: true,
            imageUrl: true,
            _count: { select: { photos: true } },
          },
        });
      if (!current) return r.status(404).json({ error: "Story not found" });
      if (!canEditArticle(q, current))
        return r
          .status(403)
          .json({ error: "You can only edit your own stories" });
      const mediaLimit = storyMediaLimit(q.user!.role);
      if (current._count.photos >= mediaLimit)
        return r
          .status(400)
          .json({
            error: `A story can have up to ${mediaLimit} photos or videos`,
          });
      const media = await saveStoryMedia(`story-${current.id}`, dataUrl),
        requiresReview = reviewChanges(q, current.status);
      await db.$transaction([
        db.articlePhoto.create({
          data: {
            articleId: current.id,
            url: media.url,
            caption: caption || null,
            sortOrder: current._count.photos,
          },
        }),
        db.article.update({
          where: { id: current.id },
          data: {
            imageUrl: media.isVideo
              ? current.imageUrl
              : current.imageUrl || media.url,
            status: requiresReview ? ArticleStatus.REVIEW : undefined,
            publishedAt: requiresReview ? null : undefined,
            isHeadline: requiresReview ? false : undefined,
          },
        }),
      ]);
      const article = await db.article.findUnique({
        where: { id: current.id },
        include: articleInclude,
      });
      await db.auditLog.create({
        data: {
          action: media.isVideo ? "ARTICLE_VIDEO_ADDED" : "ARTICLE_PHOTO_ADDED",
          actorId: q.user!.id,
          metadata: { articleId: current.id, caption, requiresReview },
        },
      });
      r.status(201).json(article);
    } catch (e: any) {
      r.status(400).json({
        error: e?.message || "Could not upload story media",
      });
    }
  },
);
app.put(
  "/api/newsroom/articles/:id/photos",
  auth(newsroomRoles),
  async (q: Req, r) => {
    const current = await db.article.findUnique({
      where: { id: q.params.id },
      select: {
        id: true,
        authorId: true,
        status: true,
        photos: { select: { id: true, url: true } },
      },
    });
    if (!current) return r.status(404).json({ error: "Story not found" });
    if (!canEditArticle(q, current))
      return r.status(403).json({ error: "You can only edit your own stories" });
    const { photoIds } = storyPhotoOrderBody.parse(q.body);
    const currentIds = new Set(current.photos.map((photo) => photo.id));
    if (
      photoIds.length !== current.photos.length ||
      photoIds.some((id) => !currentIds.has(id))
    )
      return r.status(400).json({
        error: "Media order must include every story photo and video",
      });
    const byId = new Map(current.photos.map((photo) => [photo.id, photo]));
    const firstImage = photoIds
      .map((id) => byId.get(id))
      .find((photo) => photo && !isVideoUploadUrl(photo.url));
    const requiresReview = reviewChanges(q, current.status);
    await db.$transaction([
      ...photoIds.map((id, sortOrder) =>
        db.articlePhoto.update({ where: { id }, data: { sortOrder } }),
      ),
      db.article.update({
        where: { id: current.id },
        data: {
          imageUrl: firstImage?.url || null,
          status: requiresReview ? ArticleStatus.REVIEW : undefined,
          publishedAt: requiresReview ? null : undefined,
          isHeadline: requiresReview ? false : undefined,
        },
      }),
    ]);
    const article = await db.article.findUnique({
      where: { id: current.id },
      include: articleInclude,
    });
    await db.auditLog.create({
      data: {
        action: "ARTICLE_MEDIA_REORDERED",
        actorId: q.user!.id,
        metadata: { articleId: current.id, photoIds, requiresReview },
      },
    });
    r.json(article);
  },
);
app.patch(
  "/api/newsroom/articles/:id/photos/:photoId",
  auth(newsroomRoles),
  async (q: Req, r) => {
    const current = await db.article.findUnique({
        where: { id: q.params.id },
        select: { id: true, authorId: true, status: true },
      }),
      photo = await db.articlePhoto.findFirst({
        where: { id: q.params.photoId, articleId: q.params.id },
      });
    if (!current || !photo)
      return r.status(404).json({ error: "Story photo not found" });
    if (!canEditArticle(q, current))
      return r
        .status(403)
        .json({ error: "You can only edit your own stories" });
    const { caption } = storyPhotoUpdate.parse(q.body),
      requiresReview = reviewChanges(q, current.status);
    await db.$transaction([
      db.articlePhoto.update({
        where: { id: photo.id },
        data: { caption: caption || null },
      }),
      db.article.update({
        where: { id: current.id },
        data: {
          status: requiresReview ? ArticleStatus.REVIEW : undefined,
          publishedAt: requiresReview ? null : undefined,
          isHeadline: requiresReview ? false : undefined,
        },
      }),
    ]);
    const article = await db.article.findUnique({
      where: { id: current.id },
      include: articleInclude,
    });
    await db.auditLog.create({
      data: {
        action: "ARTICLE_PHOTO_CAPTION_UPDATED",
        actorId: q.user!.id,
        metadata: { articleId: current.id, photoId: photo.id, requiresReview },
      },
    });
    r.json(article);
  },
);
app.delete(
  "/api/newsroom/articles/:id/photos/:photoId",
  auth(newsroomRoles),
  async (q: Req, r) => {
    const current = await db.article.findUnique({
        where: { id: q.params.id },
        select: { id: true, authorId: true, status: true, imageUrl: true },
      }),
      photo = await db.articlePhoto.findFirst({
        where: { id: q.params.photoId, articleId: q.params.id },
      });
    if (!current || !photo)
      return r.status(404).json({ error: "Story media not found" });
    if (!canEditArticle(q, current))
      return r
        .status(403)
        .json({ error: "You can only edit your own stories" });
    const remaining = await db.articlePhoto.findMany({
        where: { articleId: current.id, id: { not: photo.id } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      nextImage = remaining.find((item) => !isVideoUploadUrl(item.url)),
      requiresReview = reviewChanges(q, current.status);
    await db.$transaction([
      db.articlePhoto.delete({ where: { id: photo.id } }),
      db.article.update({
        where: { id: current.id },
        data: {
          imageUrl:
            current.imageUrl === photo.url
              ? nextImage?.url || null
              : current.imageUrl,
          status: requiresReview ? ArticleStatus.REVIEW : undefined,
          publishedAt: requiresReview ? null : undefined,
        },
      }),
    ]);
    await removeUploadFile(photo.url);
    const article = await db.article.findUnique({
      where: { id: current.id },
      include: articleInclude,
    });
    await db.auditLog.create({
      data: {
        action: isVideoUploadUrl(photo.url)
          ? "ARTICLE_VIDEO_REMOVED"
          : "ARTICLE_PHOTO_REMOVED",
        actorId: q.user!.id,
        metadata: { articleId: current.id, photoId: photo.id, requiresReview },
      },
    });
    r.json(article);
  },
);
app.post(
  "/api/newsroom/articles/:id/image",
  auth(newsroomRoles),
  async (q: Req, r) => {
    try {
      const { dataUrl, caption } = storyImageBody.parse(q.body),
        current = await db.article.findUnique({
          where: { id: q.params.id },
          select: {
            id: true,
            authorId: true,
            status: true,
            imageUrl: true,
            _count: { select: { photos: true } },
          },
        });
      if (!current) return r.status(404).json({ error: "Story not found" });
      if (!canEditArticle(q, current))
        return r
          .status(403)
          .json({ error: "You can only edit your own stories" });
      const lead = current.imageUrl
          ? await db.articlePhoto.findFirst({
              where: { articleId: current.id, url: current.imageUrl },
            })
          : null,
        url = await saveImage(
          `story-${current.id}`,
          dataUrl,
          current.imageUrl,
          5 * 1024 * 1024,
        ),
        requiresReview = reviewChanges(q, current.status);
      await db.$transaction([
        lead
          ? db.articlePhoto.update({
              where: { id: lead.id },
              data: { url, caption: caption || lead.caption },
            })
          : db.articlePhoto.create({
              data: {
                articleId: current.id,
                url,
                caption: caption || null,
                sortOrder: 0,
              },
            }),
        db.article.update({
          where: { id: current.id },
          data: {
            imageUrl: url,
            status: requiresReview ? ArticleStatus.REVIEW : undefined,
            publishedAt: requiresReview ? null : undefined,
          },
        }),
      ]);
      const article = await db.article.findUnique({
        where: { id: current.id },
        include: articleInclude,
      });
      r.json(article);
    } catch (e: any) {
      r.status(400).json({
        error: e?.message || "Could not upload story photo",
      });
    }
  },
);
app.delete(
  "/api/newsroom/articles/:id/image",
  auth(newsroomRoles),
  async (q: Req, r) => {
    const current = await db.article.findUnique({
      where: { id: q.params.id },
      select: { id: true, authorId: true, status: true, imageUrl: true },
    });
    if (!current) return r.status(404).json({ error: "Story not found" });
    if (!canEditArticle(q, current))
      return r
        .status(403)
        .json({ error: "You can only edit your own stories" });
    const lead = current.imageUrl
        ? await db.articlePhoto.findFirst({
            where: { articleId: current.id, url: current.imageUrl },
          })
        : null,
      next = await db.articlePhoto.findFirst({
        where: {
          articleId: current.id,
          id: lead ? { not: lead.id } : undefined,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      requiresReview = reviewChanges(q, current.status);
    if (lead) await db.articlePhoto.delete({ where: { id: lead.id } });
    await db.article.update({
      where: { id: current.id },
      data: {
        imageUrl: next?.url || null,
        status: requiresReview ? ArticleStatus.REVIEW : undefined,
        publishedAt: requiresReview ? null : undefined,
      },
    });
    await removeUploadFile(current.imageUrl);
    r.json(
      await db.article.findUnique({
        where: { id: current.id },
        include: articleInclude,
      }),
    );
  },
);
app.get("/api/articles", optionalAuth, async (q: Req, r) => {
  await expirePublishedArticles();
  const categoryId =
    typeof q.query.categoryId === "string" ? q.query.categoryId : undefined;
  const articles = await db.article.findMany({
    where: {
      status: ArticleStatus.PUBLISHED,
      categoryId,
      ...publishedVisibility(q),
    },
    include: articleInclude,
    orderBy: [
      { storyDate: { sort: "desc", nulls: "last" } },
      { publishedAt: "desc" },
    ],
  });
  r.json(articles);
});
app.get(
  "/api/editor/articles",
  auth([Role.ADMIN, Role.EDITOR]),
  async (_q, r) => {
    await expirePublishedArticles();
    r.json(
      await db.article.findMany({
        where: {
          status: {
            in: [
              ArticleStatus.DRAFT,
              ArticleStatus.REVIEW,
              ArticleStatus.REVISION,
              ArticleStatus.ARCHIVED,
            ],
          },
        },
        include: articleInclude,
        orderBy: { updatedAt: "desc" },
      }),
    );
  },
);
app.get("/api/articles/:slug", optionalAuth, async (q: Req, r) => {
  await expirePublishedArticles();
  const current = await db.article.findFirst({
    where: {
      slug: q.params.slug,
      status: ArticleStatus.PUBLISHED,
      ...publishedVisibility(q),
    },
    select: { id: true },
  });
  if (!current) return r.status(404).json({ error: "Story not found" });
  const article = await db.article.update({
    where: { id: current.id },
    data: { views: { increment: 1 } },
    include: articleInclude,
  });
  r.json(article);
});
const responseCategories = Object.values(ResponseCategory),
  responseCounts = (grouped: any[]) =>
    Object.fromEntries(
      responseCategories.map((category) => [
        category,
        grouped.find((item) => item.category === category)?._count._all || 0,
      ]),
    ),
  responseUsers = (items: any[]) =>
    Object.fromEntries(
      responseCategories.map((category) => [
        category,
        items
          .filter((item) => item.category === category)
          .map((item) => item.user),
      ]),
    );
const responseState = async (articleId: string, userId?: string) => {
  const [grouped, viewer, responders] = await Promise.all([
    db.storyResponse.groupBy({
      by: ["category"],
      where: { articleId },
      _count: { _all: true },
    }),
    userId
      ? db.storyResponse.findUnique({
          where: { userId_articleId: { userId, articleId } },
          select: { category: true },
        })
      : null,
    db.storyResponse.findMany({
      where: { articleId },
      select: { category: true, user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    responses: responseCounts(grouped),
    responders: responseUsers(responders),
    viewerResponse: viewer?.category || null,
  };
};
const photoResponseStates = async (photoIds: string[], userId?: string) => {
  const [grouped, viewer, responders] = photoIds.length
    ? await Promise.all([
        db.photoResponse.groupBy({
          by: ["photoId", "category"],
          where: { photoId: { in: photoIds } },
          _count: { _all: true },
        }),
        userId
          ? db.photoResponse.findMany({
              where: { userId, photoId: { in: photoIds } },
              select: { photoId: true, category: true },
            })
          : [],
        db.photoResponse.findMany({
          where: { photoId: { in: photoIds } },
          select: {
            photoId: true,
            category: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
      ])
    : [[], [], []];
  return Object.fromEntries(
    photoIds.map((photoId) => [
      photoId,
      {
        responses: responseCounts(
          grouped.filter((item) => item.photoId === photoId),
        ),
        responders: responseUsers(
          responders.filter((item) => item.photoId === photoId),
        ),
        viewerResponse:
          viewer.find((item) => item.photoId === photoId)?.category || null,
      },
    ]),
  );
};
const publicCommentSelect = {
  id: true,
  body: true,
  createdAt: true,
  user: { select: { id: true, name: true, avatarUrl: true } },
};
app.get("/api/articles/:id/discussion", optionalAuth, async (q: Req, r) => {
  const article = await db.article.findFirst({
    where: {
      id: q.params.id,
      status: ArticleStatus.PUBLISHED,
      ...publishedVisibility(q),
    },
    select: { id: true, photos: { select: { id: true } } },
  });
  if (!article) return r.status(404).json({ error: "Story not found" });
  const photoIds = article.photos.map((photo) => photo.id);
  r.json({
    ...(await responseState(article.id, q.user?.id)),
    photoResponses: await photoResponseStates(photoIds, q.user?.id),
    comments: await db.comment.findMany({
      where: { articleId: article.id, approved: true },
      select: publicCommentSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  });
});
app.post("/api/articles/:id/responses", auth(), async (q: Req, r) => {
  const { category } = z
      .object({ category: z.nativeEnum(ResponseCategory) })
      .parse(q.body),
    article = await db.article.findFirst({
      where: {
        id: q.params.id,
        status: ArticleStatus.PUBLISHED,
        ...publishedVisibility(q),
      },
      select: { id: true },
    });
  if (!article) return r.status(404).json({ error: "Story not found" });
  await db.storyResponse.upsert({
    where: { userId_articleId: { userId: q.user!.id, articleId: article.id } },
    update: { category },
    create: { userId: q.user!.id, articleId: article.id, category },
  });
  await db.auditLog.create({
    data: {
      action: "STORY_RESPONSE_SAVED",
      actorId: q.user!.id,
      metadata: { articleId: article.id, category },
    },
  });
  r.json(await responseState(article.id, q.user!.id));
});
app.post(
  "/api/articles/:articleId/photos/:photoId/responses",
  auth(),
  async (q: Req, r) => {
    const { category } = z
        .object({ category: z.nativeEnum(ResponseCategory) })
        .parse(q.body),
      photo = await db.articlePhoto.findFirst({
        where: {
          id: q.params.photoId,
          articleId: q.params.articleId,
          article: {
            status: ArticleStatus.PUBLISHED,
            ...publishedVisibility(q),
          },
        },
        select: { id: true },
      });
    if (!photo) return r.status(404).json({ error: "Story photo not found" });
    await db.photoResponse.upsert({
      where: { userId_photoId: { userId: q.user!.id, photoId: photo.id } },
      update: { category },
      create: { userId: q.user!.id, photoId: photo.id, category },
    });
    await db.auditLog.create({
      data: {
        action: "PHOTO_RESPONSE_SAVED",
        actorId: q.user!.id,
        metadata: {
          articleId: q.params.articleId,
          photoId: photo.id,
          category,
        },
      },
    });
    const state = await photoResponseStates([photo.id], q.user!.id);
    r.json(state[photo.id]);
  },
);
app.post("/api/articles/:id/comments", auth(), async (q: Req, r) => {
  const { body } = z
      .object({ body: z.string().trim().min(2).max(1000) })
      .parse(q.body),
    article = await db.article.findFirst({
      where: {
        id: q.params.id,
        status: ArticleStatus.PUBLISHED,
        ...publishedVisibility(q),
      },
      select: { id: true },
    });
  if (!article) return r.status(404).json({ error: "Story not found" });
  const comment = await db.comment.create({
    data: { body, approved: true, userId: q.user!.id, articleId: article.id },
    select: publicCommentSelect,
  });
  await db.auditLog.create({
    data: {
      action: "STORY_COMMENT_CREATED",
      actorId: q.user!.id,
      metadata: { articleId: article.id, commentId: comment.id },
    },
  });
  r.status(201).json(comment);
});
const meSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  permissions: true,
  organizationLevel: true,
  createdAt: true,
  updatedAt: true,
  locked: true,
  suspended: true,
  department: { select: { name: true } },
  harmonyGroup: { select: { id: true, name: true } },
  mutualLoveGroup: { select: { id: true, name: true } },
  cooperationUnit: { select: { id: true, name: true } },
  assignedCategories: { select: { name: true } },
};
app.get("/api/me", auth(), async (q: Req, r) => {
  const user = await db.user.findUnique({
    where: { id: q.user!.id },
    select: meSelect,
  });
  user ? r.json(user) : r.status(404).json({ error: "User not found" });
});
app.patch("/api/me", auth(), async (q: Req, r) => {
  const data = z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      email: z.string().email().optional(),
    })
    .parse(q.body);
  if (data.email) {
    const exists = await db.user.findFirst({
      where: { email: data.email, NOT: { id: q.user!.id } },
    });
    if (exists)
      return r.status(409).json({ error: "That email is already in use" });
  }
  const user = await db.user.update({
    where: { id: q.user!.id },
    data,
    select: meSelect,
  });
  await db.auditLog.create({
    data: {
      action: "PROFILE_UPDATED",
      actorId: q.user!.id,
      metadata: { changes: Object.keys(data) },
    },
  });
  r.json(user);
});
app.post("/api/me/password", auth(), async (q: Req, r) => {
  const { currentPassword, newPassword } = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    })
    .parse(q.body);
  const user = await db.user.findUnique({
    where: { id: q.user!.id },
    select: { password: true },
  });
  if (!user || !(await bcrypt.compare(currentPassword, user.password)))
    return r.status(400).json({ error: "Current password is incorrect" });
  await db.user.update({
    where: { id: q.user!.id },
    data: { password: await bcrypt.hash(newPassword, 12) },
  });
  await db.auditLog.create({
    data: { action: "PASSWORD_CHANGED", actorId: q.user!.id },
  });
  r.json({ ok: true });
});
app.delete("/api/me", auth(), async (q: Req, r) => {
  const { password } = z.object({ password: z.string().min(1) }).parse(q.body);
  const user = await db.user.findUnique({
    where: { id: q.user!.id },
    select: {
      password: true,
      _count: { select: { articles: true, comments: true } },
    },
  });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return r.status(400).json({ error: "Password is incorrect" });
  if (user._count.articles)
    return r
      .status(409)
      .json({
        error: "Accounts with published stories cannot be self-deleted",
      });
  await db.comment.deleteMany({ where: { userId: q.user!.id } });
  await db.user.delete({ where: { id: q.user!.id } });
  await db.auditLog.create({
    data: { action: "ACCOUNT_DELETED", actorId: q.user!.id },
  });
  r.status(204).end();
});
const cooperationPersonSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  stayArea: true,
  labels: true,
  role: true,
  avatarUrl: true,
  organizationLevel: true,
  harmonyGroup: { select: { id: true, name: true } },
  mutualLoveGroup: { select: { id: true, name: true } },
  cooperationUnit: { select: { id: true, name: true } },
};
app.get("/api/people/cooperation", auth(), async (q: Req, r) => {
  const leader = await db.user.findUnique({
    where: { id: q.user!.id },
    select: {
      organizationLevel: true,
      harmonyGroupId: true,
      mutualLoveGroupId: true,
      harmonyGroup: { select: { name: true } },
      mutualLoveGroup: { select: { name: true } },
    },
  });
  if (!leader) return r.status(404).json({ error: "User not found" });
  if (leader.organizationLevel !== "COOPERATION_LEADER")
    return r.status(403).json({ error: "Cooperation Leader access required" });
  if (!leader.harmonyGroupId || !leader.mutualLoveGroupId)
    return r
      .status(400)
      .json({
        error: "Assign Harmony and MutualLove to this Cooperation Leader first",
      });
  const people = await db.user.findMany({
    where: {
      role: { in: [Role.DADE, Role.VOLUNTEER] },
      harmonyGroupId: leader.harmonyGroupId,
      mutualLoveGroupId: leader.mutualLoveGroupId,
    },
    select: cooperationPersonSelect,
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  r.json({
    scope: {
      harmony: leader.harmonyGroup?.name || "",
      mutualLove: leader.mutualLoveGroup?.name || "",
    },
    people,
  });
});
const readerProfileSelect = {
  id: true,
  name: true,
  email: true,
  stayArea: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  harmonyGroup: true,
  mutualLoveGroup: true,
  cooperationUnit: true,
};
app.get("/api/me/reader-profile", auth(), async (q: Req, r) => {
  const user = await db.user.findUnique({
    where: { id: q.user!.id },
    select: readerProfileSelect,
  });
  user ? r.json(user) : r.status(404).json({ error: "User not found" });
});
app.patch("/api/me/reader-profile", auth(), async (q: Req, r) => {
  const data = z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      email: z.string().email().optional(),
      stayArea: z.string().trim().min(2).max(120).optional(),
      harmonyGroupId: z.string().nullable().optional(),
      mutualLoveGroupId: z.string().nullable().optional(),
      cooperationUnitId: z.string().nullable().optional(),
    })
    .parse(q.body);
  if (
    data.email &&
    (await db.user.findFirst({
      where: { email: data.email, NOT: { id: q.user!.id } },
    }))
  )
    return r.status(409).json({ error: "That email is already in use" });
  if (data.mutualLoveGroupId) {
    const mutual = await db.mutualLoveGroup.findUnique({
      where: { id: data.mutualLoveGroupId },
    });
    if (!mutual || mutual.harmonyId !== data.harmonyGroupId)
      return r
        .status(400)
        .json({ error: "MutualLove does not belong to the selected Harmony" });
  }
  if (data.cooperationUnitId) {
    const unit = await db.cooperationUnit.findUnique({
      where: { id: data.cooperationUnitId },
    });
    if (!unit || unit.mutualLoveId !== data.mutualLoveGroupId)
      return r
        .status(400)
        .json({
          error: "Cooperation does not belong to the selected MutualLove",
        });
  }
  const user = await db.user.update({
    where: { id: q.user!.id },
    data,
    select: readerProfileSelect,
  });
  await db.auditLog.create({
    data: {
      action: "READER_PROFILE_UPDATED",
      actorId: q.user!.id,
      metadata: {
        changes: Object.keys(data),
        hierarchy: [
          user.harmonyGroup?.name,
          user.mutualLoveGroup?.name,
          user.cooperationUnit?.name,
        ],
      },
    },
  });
  r.json(user);
});
app.get("/api/org-structure-options", auth(), async (_q, r) =>
  r.json(
    await db.harmonyGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        mutualLoves: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            cooperations: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
          },
        },
      },
    }),
  ),
);
const articleInput = z.object({
  title: z.string().min(8),
  excerpt: richTextField(20, 600),
  content: richTextField(40),
  categoryId: z.string(),
  isBreaking: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});
app.post("/api/articles", auth(), async (q: Req, r) => {
  if (!(await canCreateStory(q.user!.id)))
    return r
      .status(403)
      .json({
        error:
          "Only administrators and Humanistic Mission members can create stories",
      });
  const x = articleInput.parse(q.body),
    slug =
      x.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString(36),
    article = await db.article.create({
      data: {
        ...x,
        isPublic: hasFullStoryAccess(q.user!.role)
          ? (x.isPublic ?? true)
          : true,
        slug,
        authorId: q.user!.id,
      },
    });
  await db.auditLog.create({
    data: {
      action: "ARTICLE_CREATED",
      actorId: q.user!.id,
      metadata: {
        articleId: article.id,
        title: article.title,
        isPublic: article.isPublic,
      },
    },
  });
  r.status(201).json(article);
});
app.patch(
  "/api/articles/:id/status",
  auth([Role.ADMIN, Role.EDITOR]),
  async (q: Req, r) => {
    const { status } = z
      .object({
        status: z.enum([ArticleStatus.PUBLISHED, ArticleStatus.REVISION]),
      })
      .parse(q.body);
    const a = await db.article.update({
      where: { id: q.params.id },
      data: {
        status,
        publishedAt: status === ArticleStatus.PUBLISHED ? new Date() : null,
        isHeadline: status === ArticleStatus.PUBLISHED ? undefined : false,
      },
    });
    await db.auditLog.create({
      data: {
        action: `ARTICLE_${status}`,
        actorId: q.user!.id,
        metadata: { articleId: a.id },
      },
    });
    r.json(a);
  },
);
app.patch(
  "/api/articles/:id/republish",
  auth([Role.ADMIN, Role.EDITOR]),
  async (q: Req, r) => {
    const current = await db.article.findUnique({
      where: { id: q.params.id },
      select: { id: true, status: true },
    });
    if (!current) return r.status(404).json({ error: "Story not found" });
    if (current.status !== ArticleStatus.ARCHIVED)
      return r
        .status(400)
        .json({ error: "Only expired stories can be republished" });
    const article = await db.article.update({
      where: { id: current.id },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
        isHeadline: false,
      },
      include: articleInclude,
    });
    await db.auditLog.create({
      data: {
        action: "ARTICLE_REPUBLISHED",
        actorId: q.user!.id,
        metadata: { articleId: article.id },
      },
    });
    r.json(article);
  },
);
app.patch(
  "/api/articles/:id/headline",
  auth([Role.ADMIN, Role.EDITOR]),
  async (q: Req, r) => {
    const { isHeadline } = z.object({ isHeadline: z.boolean() }).parse(q.body),
      current = await db.article.findUnique({
        where: { id: q.params.id },
        select: { id: true, status: true, isPublic: true },
      });
    if (!current) return r.status(404).json({ error: "Story not found" });
    if (isHeadline && current.status !== ArticleStatus.PUBLISHED)
      return r
        .status(400)
        .json({
          error: "Only published stories can be selected as the headline",
        });
    if (isHeadline && !current.isPublic)
      return r
        .status(400)
        .json({ error: "Only public stories can be selected as the headline" });
    await db.$transaction([
      db.article.updateMany({
        where: { isHeadline: true, id: { not: current.id } },
        data: { isHeadline: false },
      }),
      db.article.update({ where: { id: current.id }, data: { isHeadline } }),
    ]);
    const article = await db.article.findUnique({
      where: { id: current.id },
      include: articleInclude,
    });
    await db.auditLog.create({
      data: {
        action: isHeadline
          ? "ARTICLE_HEADLINE_SET"
          : "ARTICLE_HEADLINE_REMOVED",
        actorId: q.user!.id,
        metadata: { articleId: current.id },
      },
    });
    r.json(article);
  },
);
app.patch(
  "/api/articles/:id/unpublish",
  auth(newsroomRoles),
  async (q: Req, r) => {
    const current = await db.article.findUnique({
      where: { id: q.params.id },
      select: { id: true, authorId: true, status: true },
    });
    if (!current) return r.status(404).json({ error: "Story not found" });
    if (!canEditArticle(q, current))
      return r
        .status(403)
        .json({ error: "You can only unpublish your own stories" });
    if (current.status !== ArticleStatus.PUBLISHED)
      return r
        .status(400)
        .json({ error: "Only published stories can be unpublished" });
    const article = await db.article.update({
      where: { id: current.id },
      data: {
        status: ArticleStatus.DRAFT,
        publishedAt: null,
        isHeadline: false,
      },
      include: articleInclude,
    });
    await db.auditLog.create({
      data: {
        action: "ARTICLE_UNPUBLISHED",
        actorId: q.user!.id,
        metadata: { articleId: article.id },
      },
    });
    r.json(article);
  },
);
Object.assign(articleInput.shape, { storyDate: storyDateField });
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  roles: true,
  customRoles: true,
  locked: true,
  createdAt: true,
  _count: { select: { articles: true } },
};
app.get("/api/users", auth([Role.ADMIN]), async (_q, r) =>
  r.json(
    await db.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "desc" },
    }),
  ),
);
app.post("/api/users", auth([Role.ADMIN]), async (q: Req, r) => {
  const x = z
    .object({
      name: z.string().min(2),
      email: z.string().email(),
      role: z.nativeEnum(Role),
      password: z.string().min(8),
    })
    .parse(q.body);
  const exists = await db.user.findUnique({ where: { email: x.email } });
  if (exists)
    return r.status(409).json({ error: "That email is already in use" });
  const user = await db.user.create({
    data: { ...x, password: await bcrypt.hash(x.password, 12) },
    select: userSelect,
  });
  await db.auditLog.create({
    data: {
      action: "USER_CREATED",
      actorId: q.user!.id,
      metadata: { userId: user.id, role: user.role },
    },
  });
  r.status(201).json(user);
});
app.patch("/api/users/:id", auth([Role.ADMIN]), async (q: Req, r) => {
  const data = z
    .object({
      name: z.string().min(2).optional(),
      role: z.nativeEnum(Role).optional(),
      locked: z.boolean().optional(),
    })
    .parse(q.body);
  if (q.user!.id === q.params.id && data.locked)
    return r.status(400).json({ error: "You cannot lock your own account" });
  const user = await db.user.update({
    where: { id: q.params.id },
    data,
    select: userSelect,
  });
  await db.auditLog.create({
    data: {
      action: "USER_UPDATED",
      actorId: q.user!.id,
      metadata: { userId: user.id, ...data },
    },
  });
  r.json(user);
});
app.delete("/api/users/:id", auth([Role.ADMIN]), async (q: Req, r) => {
  if (q.user!.id === q.params.id)
    return r.status(400).json({ error: "You cannot delete your own account" });
  const linked = await db.user.findUnique({
    where: { id: q.params.id },
    select: { _count: { select: { articles: true, comments: true } } },
  });
  if (!linked) return r.status(404).json({ error: "User not found" });
  if (linked._count.articles || linked._count.comments)
    return r
      .status(409)
      .json({
        error: "This user has published content. Lock the account instead.",
      });
  await db.user.delete({ where: { id: q.params.id } });
  await db.auditLog.create({
    data: {
      action: "USER_DELETED",
      actorId: q.user!.id,
      metadata: { userId: q.params.id },
    },
  });
  r.status(204).end();
});
const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  locked: true,
  suspended: true,
  permissions: true,
  lastLoginAt: true,
  createdAt: true,
  department: true,
  assignedCategories: { select: { id: true, name: true } },
  _count: { select: { articles: true } },
};
const userAdminInput = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  password: z.string().min(8).optional(),
  locked: z.boolean().optional(),
  suspended: z.boolean().optional(),
  departmentId: z.string().nullable().optional(),
  categoryIds: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});
app.get("/api/admin/user-options", auth([Role.ADMIN]), async (_q, r) =>
  r.json({
    departments: await db.department.findMany({ orderBy: { name: "asc" } }),
    categories: await db.category.findMany({
      where: { archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  }),
);
app.get("/api/admin/users", auth([Role.ADMIN]), async (_q, r) =>
  r.json(
    await db.user.findMany({
      select: adminUserSelect,
      orderBy: { createdAt: "desc" },
    }),
  ),
);
app.post("/api/admin/users", auth([Role.ADMIN]), async (q: Req, r) => {
  const x = userAdminInput
    .extend({ password: z.string().min(8) })
    .parse(q.body);
  if (await db.user.findUnique({ where: { email: x.email } }))
    return r.status(409).json({ error: "That email is already in use" });
  const { categoryIds = [], departmentId, ...data } = x;
  const user = await db.user.create({
    data: {
      ...data,
      password: await bcrypt.hash(x.password, 12),
      department: departmentId ? { connect: { id: departmentId } } : undefined,
      assignedCategories: { connect: categoryIds.map((id) => ({ id })) },
    },
    select: adminUserSelect,
  });
  await db.auditLog.create({
    data: {
      action: "USER_CREATED",
      actorId: q.user!.id,
      metadata: { userId: user.id, email: user.email },
    },
  });
  r.status(201).json(user);
});
app.patch("/api/admin/users/:id", auth([Role.ADMIN]), async (q: Req, r) => {
  const x = userAdminInput
    .partial()
    .omit({ password: true, email: true })
    .parse(q.body);
  if (q.user!.id === q.params.id && (x.locked || x.suspended))
    return r
      .status(400)
      .json({ error: "You cannot deactivate your own account" });
  const { categoryIds, departmentId, ...data } = x;
  const user = await db.user.update({
    where: { id: q.params.id },
    data: {
      ...data,
      department:
        departmentId === undefined
          ? undefined
          : departmentId
            ? { connect: { id: departmentId } }
            : { disconnect: true },
      assignedCategories: categoryIds
        ? { set: categoryIds.map((id) => ({ id })) }
        : undefined,
    },
    select: adminUserSelect,
  });
  await db.auditLog.create({
    data: {
      action: "USER_UPDATED",
      actorId: q.user!.id,
      metadata: { userId: user.id, changes: Object.keys(x) },
    },
  });
  r.json(user);
});
app.post(
  "/api/admin/users/:id/reset-password",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    if (!(await requirePersonInScope(q, r, q.params.id))) return;
    const { password } = z
      .object({ password: z.string().min(8) })
      .parse(q.body);
    const user = await db.user.update({
      where: { id: q.params.id },
      data: { password: await bcrypt.hash(password, 12) },
      select: { id: true, email: true },
    });
    await db.auditLog.create({
      data: {
        action: "PASSWORD_RESET",
        actorId: q.user!.id,
        metadata: { userId: user.id, email: user.email },
      },
    });
    r.json({ ok: true });
  },
);
app.delete("/api/admin/users/:id", auth([Role.ADMIN]), async (q: Req, r) => {
  if (!(await requirePersonInScope(q, r, q.params.id))) return;
  if (q.user!.id === q.params.id)
    return r.status(400).json({ error: "You cannot delete your own account" });
  const linked = await db.user.findUnique({
    where: { id: q.params.id },
    select: { _count: { select: { articles: true, comments: true } } },
  });
  if (!linked) return r.status(404).json({ error: "User not found" });
  if (linked._count.articles || linked._count.comments)
    return r
      .status(409)
      .json({
        error: "This user has published content. Suspend the account instead.",
      });
  await db.user.delete({ where: { id: q.params.id } });
  await db.auditLog.create({
    data: {
      action: "USER_DELETED",
      actorId: q.user!.id,
      metadata: { userId: q.params.id },
    },
  });
  r.status(204).end();
});
app.get("/api/admin/activity-logs", auth([Role.ADMIN]), async (_q, r) =>
  r.json(
    await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ),
);
const departmentSelect = {
  id: true,
  name: true,
  createdAt: true,
  _count: { select: { users: true } },
};
app.get("/api/admin/departments", auth([Role.ADMIN]), async (_q, r) =>
  r.json(
    await db.department.findMany({
      select: departmentSelect,
      orderBy: { name: "asc" },
    }),
  ),
);
app.post("/api/admin/departments", auth([Role.ADMIN]), async (q: Req, r) => {
  const { name } = z
    .object({ name: z.string().trim().min(2).max(80) })
    .parse(q.body);
  if (await db.department.findUnique({ where: { name } }))
    return r
      .status(409)
      .json({ error: "A department with this name already exists" });
  const department = await db.department.create({
    data: { name },
    select: departmentSelect,
  });
  await db.auditLog.create({
    data: {
      action: "DEPARTMENT_CREATED",
      actorId: q.user!.id,
      metadata: { departmentId: department.id, name },
    },
  });
  r.status(201).json(department);
});
app.patch(
  "/api/admin/departments/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const { name } = z
      .object({ name: z.string().trim().min(2).max(80) })
      .parse(q.body);
    const department = await db.department.update({
      where: { id: q.params.id },
      data: { name },
      select: departmentSelect,
    });
    await db.auditLog.create({
      data: {
        action: "DEPARTMENT_UPDATED",
        actorId: q.user!.id,
        metadata: { departmentId: department.id, name },
      },
    });
    r.json(department);
  },
);
app.delete(
  "/api/admin/departments/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const department = await db.department.findUnique({
      where: { id: q.params.id },
      select: { name: true, _count: { select: { users: true } } },
    });
    if (!department)
      return r.status(404).json({ error: "Department not found" });
    if (department._count.users)
      return r
        .status(409)
        .json({ error: "Move assigned users before deleting this department" });
    await db.department.delete({ where: { id: q.params.id } });
    await db.auditLog.create({
      data: {
        action: "DEPARTMENT_DELETED",
        actorId: q.user!.id,
        metadata: { departmentId: q.params.id, name: department.name },
      },
    });
    r.status(204).end();
  },
);
const categorySelect = {
  id: true,
  name: true,
  slug: true,
  archived: true,
  _count: { select: { articles: true, assignedUsers: true } },
};
const categoryBaseSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "category";
const availableCategorySlug = async (name: string, ignoreId?: string) => {
  const base = categoryBaseSlug(name);
  let slug = base,
    suffix = 2;
  while (
    await db.category.findFirst({
      where: { slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    })
  )
    slug = `${base}-${suffix++}`;
  return slug;
};
app.get("/api/admin/categories", auth([Role.ADMIN]), async (_q, r) =>
  r.json(
    await db.category.findMany({
      select: categorySelect,
      orderBy: [{ archived: "asc" }, { name: "asc" }],
    }),
  ),
);
app.post("/api/admin/categories", auth([Role.ADMIN]), async (q: Req, r) => {
  const { name } = z
    .object({ name: z.string().trim().min(2).max(80) })
    .parse(q.body);
  if (
    await db.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    })
  )
    return r
      .status(409)
      .json({ error: "A news category with this name already exists" });
  const category = await db.category.create({
    data: { name, slug: await availableCategorySlug(name) },
    select: categorySelect,
  });
  await db.auditLog.create({
    data: {
      action: "CATEGORY_CREATED",
      actorId: q.user!.id,
      metadata: { categoryId: category.id, name: category.name },
    },
  });
  r.status(201).json(category);
});
app.patch(
  "/api/admin/categories/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const data = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        archived: z.boolean().optional(),
      })
      .refine((x) => Object.keys(x).length > 0, "No changes supplied")
      .parse(q.body);
    const current = await db.category.findUnique({
      where: { id: q.params.id },
      select: { id: true, name: true },
    });
    if (!current)
      return r.status(404).json({ error: "News category not found" });
    if (
      data.name &&
      (await db.category.findFirst({
        where: {
          name: { equals: data.name, mode: "insensitive" },
          id: { not: current.id },
        },
        select: { id: true },
      }))
    )
      return r
        .status(409)
        .json({ error: "A news category with this name already exists" });
    const category = await db.category.update({
      where: { id: current.id },
      data: {
        ...data,
        ...(data.name
          ? { slug: await availableCategorySlug(data.name, current.id) }
          : {}),
      },
      select: categorySelect,
    });
    await db.auditLog.create({
      data: {
        action: "CATEGORY_UPDATED",
        actorId: q.user!.id,
        metadata: { categoryId: category.id, changes: Object.keys(data) },
      },
    });
    r.json(category);
  },
);
app.delete(
  "/api/admin/categories/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const category = await db.category.findUnique({
      where: { id: q.params.id },
      select: {
        name: true,
        _count: { select: { articles: true, assignedUsers: true } },
      },
    });
    if (!category)
      return r.status(404).json({ error: "News category not found" });
    if (category._count.articles || category._count.assignedUsers)
      return r
        .status(409)
        .json({
          error: "This category is in use. Archive it instead of deleting it.",
        });
    await db.category.delete({ where: { id: q.params.id } });
    await db.auditLog.create({
      data: {
        action: "CATEGORY_DELETED",
        actorId: q.user!.id,
        metadata: { categoryId: q.params.id, name: category.name },
      },
    });
    r.status(204).end();
  },
);
const orgChartInput = z.object({
  harmony: z.string().trim().min(1).max(80),
  mutualLove: z.string().trim().min(1).max(80),
  cooperation: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).optional(),
});
app.get("/api/admin/org-chart", auth([Role.ADMIN]), async (_q, r) =>
  r.json(
    await db.orgChartEntry.findMany({
      orderBy: [
        { sortOrder: "asc" },
        { mutualLove: "asc" },
        { cooperation: "asc" },
      ],
    }),
  ),
);
app.post("/api/admin/org-chart", auth([Role.ADMIN]), async (q: Req, r) => {
  const data = orgChartInput.parse(q.body);
  const item = await db.orgChartEntry.create({ data });
  await db.auditLog.create({
    data: {
      action: "ORG_CHART_CREATED",
      actorId: q.user!.id,
      metadata: { entryId: item.id, ...data },
    },
  });
  r.status(201).json(item);
});
app.patch("/api/admin/org-chart/:id", auth([Role.ADMIN]), async (q: Req, r) => {
  const data = orgChartInput.partial().parse(q.body);
  const item = await db.orgChartEntry.update({
    where: { id: q.params.id },
    data,
  });
  await db.auditLog.create({
    data: {
      action: "ORG_CHART_UPDATED",
      actorId: q.user!.id,
      metadata: { entryId: item.id, changes: Object.keys(data) },
    },
  });
  r.json(item);
});
app.delete(
  "/api/admin/org-chart/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const item = await db.orgChartEntry.delete({ where: { id: q.params.id } });
    await db.auditLog.create({
      data: {
        action: "ORG_CHART_DELETED",
        actorId: q.user!.id,
        metadata: {
          entryId: item.id,
          harmony: item.harmony,
          mutualLove: item.mutualLove,
          cooperation: item.cooperation,
        },
      },
    });
    r.status(204).end();
  },
);
const groupInput = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).optional(),
});
app.get("/api/admin/org-structure", auth([Role.ADMIN]), async (_q, r) =>
  r.json(
    await db.harmonyGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        mutualLoves: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            cooperations: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
          },
        },
      },
    }),
  ),
);
app.post("/api/admin/harmony-groups", auth([Role.ADMIN]), async (q: Req, r) => {
  const data = groupInput.parse(q.body);
  const item = await db.harmonyGroup.create({ data });
  await db.auditLog.create({
    data: {
      action: "HARMONY_CREATED",
      actorId: q.user!.id,
      metadata: { id: item.id, name: item.name },
    },
  });
  r.status(201).json(item);
});
app.patch(
  "/api/admin/harmony-groups/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const data = groupInput.partial().parse(q.body),
      item = await db.harmonyGroup.update({ where: { id: q.params.id }, data });
    await db.auditLog.create({
      data: {
        action: "HARMONY_UPDATED",
        actorId: q.user!.id,
        metadata: { id: item.id, changes: Object.keys(data) },
      },
    });
    r.json(item);
  },
);
app.delete(
  "/api/admin/harmony-groups/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const item = await db.harmonyGroup.findUnique({
      where: { id: q.params.id },
      include: { _count: { select: { mutualLoves: true } } },
    });
    if (!item) return r.status(404).json({ error: "Harmony group not found" });
    if (item._count.mutualLoves)
      return r
        .status(409)
        .json({ error: "Remove linked MutualLove groups first" });
    await db.harmonyGroup.delete({ where: { id: item.id } });
    await db.auditLog.create({
      data: {
        action: "HARMONY_DELETED",
        actorId: q.user!.id,
        metadata: { id: item.id, name: item.name },
      },
    });
    r.status(204).end();
  },
);
app.post(
  "/api/admin/mutual-love-groups",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const data = groupInput.extend({ harmonyId: z.string() }).parse(q.body);
    const item = await db.mutualLoveGroup.create({ data });
    await db.auditLog.create({
      data: {
        action: "MUTUAL_LOVE_CREATED",
        actorId: q.user!.id,
        metadata: { id: item.id, name: item.name, harmonyId: item.harmonyId },
      },
    });
    r.status(201).json(item);
  },
);
app.patch(
  "/api/admin/mutual-love-groups/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const data = groupInput
        .extend({ harmonyId: z.string() })
        .partial()
        .parse(q.body),
      item = await db.mutualLoveGroup.update({
        where: { id: q.params.id },
        data,
      });
    await db.auditLog.create({
      data: {
        action: "MUTUAL_LOVE_UPDATED",
        actorId: q.user!.id,
        metadata: { id: item.id, changes: Object.keys(data) },
      },
    });
    r.json(item);
  },
);
app.delete(
  "/api/admin/mutual-love-groups/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const item = await db.mutualLoveGroup.findUnique({
      where: { id: q.params.id },
      include: { _count: { select: { cooperations: true } } },
    });
    if (!item)
      return r.status(404).json({ error: "MutualLove group not found" });
    if (item._count.cooperations)
      return r
        .status(409)
        .json({ error: "Remove linked Cooperation units first" });
    await db.mutualLoveGroup.delete({ where: { id: item.id } });
    await db.auditLog.create({
      data: {
        action: "MUTUAL_LOVE_DELETED",
        actorId: q.user!.id,
        metadata: { id: item.id, name: item.name },
      },
    });
    r.status(204).end();
  },
);
app.post(
  "/api/admin/cooperation-units",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const data = groupInput.extend({ mutualLoveId: z.string() }).parse(q.body);
    const item = await db.cooperationUnit.create({ data });
    await db.auditLog.create({
      data: {
        action: "COOPERATION_CREATED",
        actorId: q.user!.id,
        metadata: {
          id: item.id,
          name: item.name,
          mutualLoveId: item.mutualLoveId,
        },
      },
    });
    r.status(201).json(item);
  },
);
app.patch(
  "/api/admin/cooperation-units/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const data = groupInput
        .extend({ mutualLoveId: z.string() })
        .partial()
        .parse(q.body),
      item = await db.cooperationUnit.update({
        where: { id: q.params.id },
        data,
      });
    await db.auditLog.create({
      data: {
        action: "COOPERATION_UPDATED",
        actorId: q.user!.id,
        metadata: { id: item.id, changes: Object.keys(data) },
      },
    });
    r.json(item);
  },
);
app.delete(
  "/api/admin/cooperation-units/:id",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const item = await db.cooperationUnit.delete({
      where: { id: q.params.id },
    });
    await db.auditLog.create({
      data: {
        action: "COOPERATION_DELETED",
        actorId: q.user!.id,
        metadata: { id: item.id, name: item.name },
      },
    });
    r.status(204).end();
  },
);
const accountSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  stayArea: true,
  labels: true,
  organizationLevel: true,
  role: true,
  roles: true,
  customRoles: true,
  locked: true,
  suspended: true,
  permissions: true,
  lastLoginAt: true,
  createdAt: true,
  department: true,
  harmonyGroup: true,
  mutualLoveGroup: true,
  cooperationUnit: true,
  assignedCategories: { select: { id: true, name: true } },
  _count: { select: { articles: true } },
};
const organizationLevelInput = z.enum([
  "HARMONY_LEADER",
  "MUTUAL_LOVE_LEADER",
  "COOPERATION_LEADER",
]);
const accountInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).nullable().optional(),
  stayArea: z.string().trim().max(120).nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  organizationLevel: organizationLevelInput.nullable().optional(),
  role: z.nativeEnum(Role).optional(),
  roles: z.array(z.string().trim().min(2).max(50)).min(1).max(30).optional(),
  password: z.string().min(8).optional(),
  locked: z.boolean().optional(),
  suspended: z.boolean().optional(),
  departmentId: z.string().nullable().optional(),
  harmonyGroupId: z.string().nullable().optional(),
  mutualLoveGroupId: z.string().nullable().optional(),
  cooperationUnitId: z.string().nullable().optional(),
  categoryIds: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});
const validateCustomRoles = async (roles: string[]) => {
  if (!roles.length) return;
  const configured = await db.roleMenuAccess.count({ where: { roleKey: { in: roles } } });
  if (configured !== roles.length) throw new z.ZodError([{ code: "custom", path: ["roles"], message: "One or more selected roles no longer exist" }]);
};
const peopleAccessScope = async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, roles: true, harmonyGroupId: true, mutualLoveGroupId: true },
  });
  if (!user) return null;
  const admin = [user.role, ...(user.roles || [])].includes(Role.ADMIN);
  return {
    admin,
    harmonyGroupId: user.harmonyGroupId,
    mutualLoveGroupId: user.mutualLoveGroupId,
    where: admin
      ? {}
      : {
          harmonyGroupId: user.harmonyGroupId || "__unassigned__",
          mutualLoveGroupId: user.mutualLoveGroupId || "__unassigned__",
          NOT: { OR: [{ role: Role.ADMIN }, { roles: { has: Role.ADMIN } }] },
        },
  };
};
const requirePeopleScope = async (q: Req, r: express.Response) => {
  const scope = await peopleAccessScope(q.user!.id);
  if (!scope) {
    r.status(404).json({ error: "User not found" });
    return null;
  }
  if (!scope.admin && (!scope.harmonyGroupId || !scope.mutualLoveGroupId)) {
    r.status(403).json({ error: "Harmony and MutualLove assignments are required for People access" });
    return null;
  }
  return scope;
};
const requirePersonInScope = async (q: Req, r: express.Response, userId: string) => {
  const scope = await requirePeopleScope(q, r);
  if (!scope) return null;
  const user = await db.user.findFirst({ where: { id: userId, ...scope.where }, select: { id: true } });
  if (!user) {
    r.status(403).json({ error: "This account is outside your Harmony and MutualLove scope" });
    return null;
  }
  return scope;
};
const areaOptionSelect = {
  id: true,
  name: true,
  mutualLoveId: true,
  mutualLove: { select: { id: true, name: true, harmony: { select: { id: true, name: true } } } },
};
app.get("/api/admin/accounts/options", auth([Role.ADMIN]), async (q: Req, r) => {
  const scope = await requirePeopleScope(q, r);
  if (!scope) return;
  const profiles = await db.roleMenuAccess.findMany({ select: { role: true, roleKey: true } });
  const structureWhere = scope.admin ? {} : { id: scope.harmonyGroupId! };
  const mutualWhere = scope.admin ? {} : { mutualLoveId: scope.mutualLoveGroupId! };
  const [departments, categories, structure, areas] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.category.findMany({ where: { archived: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.harmonyGroup.findMany({
      where: structureWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        mutualLoves: {
          where: scope.admin ? {} : { id: scope.mutualLoveGroupId! },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: { cooperations: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
        },
      },
    }),
    db.area.findMany({ where: mutualWhere, select: areaOptionSelect, orderBy: { name: "asc" } }),
  ]);
  r.json({
    departments,
    categories,
    structure,
    areas,
    roles: [...new Set([...(scope.admin ? Object.values(Role) : Object.values(Role).filter((role) => role !== Role.ADMIN)), ...profiles.map((profile) => profile.roleKey).filter(Boolean)])],
    scope: { admin: scope.admin, harmonyGroupId: scope.harmonyGroupId, mutualLoveGroupId: scope.mutualLoveGroupId },
  });
});
app.get("/api/admin/accounts", auth([Role.ADMIN]), async (q: Req, r) => {
  const scope = await requirePeopleScope(q, r);
  if (!scope) return;
  const [users, submissions] = await Promise.all([
    db.user.findMany({
      where: scope.where,
      select: accountSelect,
      orderBy: { createdAt: "desc" },
    }),
    db.registrationSubmission.findMany({
      where: { unregisteredAt: null },
      select: {
        contact: true,
        form: { select: { id: true, eventName: true } },
        attendances: {
          select: { eventDate: { select: { id: true, eventDate: true } } },
          orderBy: { eventDate: { eventDate: "asc" } },
        },
      },
    }),
  ]);
  const eventsByContact = new Map<string, Array<{ formId: string; eventName: string; eventDateId: string; eventDate: Date }>>();
  for (const submission of submissions) {
    const contact = normalizeLoginContact(submission.contact);
    if (contact.length < 7) continue;
    const events = eventsByContact.get(contact) || [];
    for (const attendance of submission.attendances)
      events.push({
        formId: submission.form.id,
        eventName: submission.form.eventName,
        eventDateId: attendance.eventDate.id,
        eventDate: attendance.eventDate.eventDate,
      });
    eventsByContact.set(contact, events);
  }
  r.json(users.map((user) => ({
    ...user,
    registeredEvents: user.phone
      ? (eventsByContact.get(normalizeLoginContact(user.phone)) || []).sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
      : [],
  })));
});
app.post("/api/admin/accounts", auth([Role.ADMIN]), async (q: Req, r) => {
  const scope = await requirePeopleScope(q, r);
  if (!scope) return;
  const x = accountInput.extend({ password: z.string().min(8) }).parse(q.body);
  if (await db.user.findUnique({ where: { email: x.email } }))
    return r.status(409).json({ error: "That email is already in use" });
  const { categoryIds = [], password, roles: selectedRoles, ...data } = x;
  const selected = [...new Set(selectedRoles || (data.role ? [data.role] : [Role.DADE]))];
  const roles = selected.filter((value): value is Role => Object.values(Role).includes(value as Role));
  const customRoles = selected.filter((value) => !Object.values(Role).includes(value as Role));
  if (!scope.admin && roles.includes(Role.ADMIN)) return r.status(403).json({ error: "Only administrators can assign the Administrator role" });
  if (!scope.admin && ((data.harmonyGroupId !== undefined && data.harmonyGroupId !== scope.harmonyGroupId) || (data.mutualLoveGroupId !== undefined && data.mutualLoveGroupId !== scope.mutualLoveGroupId)))
    return r.status(403).json({ error: "New accounts must remain in your Harmony and MutualLove scope" });
  await validateCustomRoles(customRoles);
  const user = await db.user.create({
    data: {
      ...data,
      role: primaryRole(roles),
      roles,
      customRoles,
      harmonyGroupId: scope.admin ? data.harmonyGroupId : scope.harmonyGroupId,
      mutualLoveGroupId: scope.admin ? data.mutualLoveGroupId : scope.mutualLoveGroupId,
      password: await bcrypt.hash(password, 12),
      assignedCategories: { connect: categoryIds.map((id) => ({ id })) },
    },
    select: accountSelect,
  });
  await db.auditLog.create({
    data: {
      action: "USER_CREATED",
      actorId: q.user!.id,
      metadata: {
        userId: user.id,
        email: user.email,
        hierarchy: [
          user.harmonyGroup?.name,
          user.mutualLoveGroup?.name,
          user.cooperationUnit?.name,
        ],
      },
    },
  });
  r.status(201).json(user);
});
app.patch("/api/admin/accounts/:id", auth([Role.ADMIN]), async (q: Req, r) => {
  const scope = await requirePersonInScope(q, r, q.params.id);
  if (!scope) return;
  const x = accountInput
    .partial()
    .omit({ password: true, email: true })
    .parse(q.body);
  if (q.user!.id === q.params.id && (x.locked || x.suspended))
    return r
      .status(400)
      .json({ error: "You cannot deactivate your own account" });
  const { categoryIds, roles: selectedRoles, ...data } = x;
  const selected = selectedRoles ? [...new Set(selectedRoles)] : undefined;
  const roles = selected?.filter((value): value is Role => Object.values(Role).includes(value as Role));
  const customRoles = selected?.filter((value) => !Object.values(Role).includes(value as Role));
  if (!scope.admin && roles?.includes(Role.ADMIN)) return r.status(403).json({ error: "Only administrators can assign the Administrator role" });
  if (!scope.admin && ((data.harmonyGroupId !== undefined && data.harmonyGroupId !== scope.harmonyGroupId) || (data.mutualLoveGroupId !== undefined && data.mutualLoveGroupId !== scope.mutualLoveGroupId)))
    return r.status(403).json({ error: "Accounts must remain in your Harmony and MutualLove scope" });
  await validateCustomRoles(customRoles || []);
  const user = await db.user.update({
    where: { id: q.params.id },
    data: {
      ...data,
      role: selected ? primaryRole(roles || []) : data.role,
      roles,
      customRoles,
      assignedCategories: categoryIds
        ? { set: categoryIds.map((id) => ({ id })) }
        : undefined,
    },
    select: accountSelect,
  });
  await db.auditLog.create({
    data: {
      action: "USER_UPDATED",
      actorId: q.user!.id,
      metadata: {
        userId: user.id,
        changes: Object.keys(x),
        hierarchy: [
          user.harmonyGroup?.name,
          user.mutualLoveGroup?.name,
          user.cooperationUnit?.name,
        ],
      },
    },
  });
  r.json(user);
});
app.get("/api/admin/accounts/:id/events", auth([Role.ADMIN]), async (q: Req, r) => {
  if (!(await requirePersonInScope(q, r, q.params.id))) return;
  const target = await db.user.findUnique({ where: { id: q.params.id }, select: { id: true, phone: true } });
  if (!target) return r.status(404).json({ error: "User not found" });
  const [forms, invitations, submissions] = await Promise.all([
    db.registrationForm.findMany({
      where: { active: true },
      select: { id: true, eventName: true, slug: true, eventDates: { select: { id: true, eventDate: true }, orderBy: { eventDate: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.registrationInvitation.findMany({
      where: { userId: target.id },
      select: { formId: true, sharePath: true, createdAt: true, invitedBy: { select: { id: true, name: true } } },
    }),
    target.phone
      ? db.registrationSubmission.findMany({
          where: { unregisteredAt: null },
          select: {
            form: { select: { id: true, eventName: true } },
            contact: true,
            attendances: { select: { totalPersons: true, meal: true, eventDate: { select: { id: true, eventDate: true } } } },
          },
        })
      : [],
  ]);
  const appointments = submissions
    .filter((submission) => isContactMatch(target.phone!, submission.contact))
    .flatMap((submission) => submission.attendances.map((attendance) => ({
      formId: submission.form.id,
      eventName: submission.form.eventName,
      eventDateId: attendance.eventDate.id,
      eventDate: attendance.eventDate.eventDate,
      totalPersons: attendance.totalPersons,
      meal: attendance.meal,
    })))
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  r.json({ forms, appointments, invitations });
});
app.post("/api/admin/accounts/:id/invitations", auth([Role.ADMIN]), async (q: Req, r) => {
  if (!(await requirePersonInScope(q, r, q.params.id))) return;
  const { formId } = z.object({ formId: z.string().min(1) }).parse(q.body);
  const form = await db.registrationForm.findFirst({ where: { id: formId, active: true }, select: { id: true, eventName: true, slug: true } });
  if (!form) return r.status(404).json({ error: "Active registration event not found" });
  const existing = await db.registrationInvitation.findUnique({
    where: { userId_formId: { userId: q.params.id, formId } },
    select: { createdAt: true, invitedBy: { select: { name: true } } },
  });
  if (existing)
    return r.status(409).json({ error: `Already invited by ${existing.invitedBy.name} on ${existing.createdAt.toLocaleDateString()}` });
  let invitation;
  try {
    const token = randomUUID();
    invitation = await db.registrationInvitation.create({
      data: { userId: q.params.id, formId, invitedById: q.user!.id, token, sharePath: `/registration/${form.slug}?invite=${encodeURIComponent(token)}` },
      select: { formId: true, sharePath: true, createdAt: true, invitedBy: { select: { id: true, name: true } } },
    });
  } catch (error: any) {
    if (error?.code === "P2002") return r.status(409).json({ error: "This user has already been invited to the event" });
    throw error;
  }
  await db.auditLog.create({ data: { action: "REGISTRATION_INVITATION_SHARED", actorId: q.user!.id, metadata: { userId: q.params.id, formId, eventName: form.eventName, sharePath: invitation.sharePath } } });
  r.status(201).json({ ...invitation, eventName: form.eventName });
});
app.post("/api/admin/accounts/:id/invitations/cancel", auth([Role.ADMIN]), async (q: Req, r) => {
  if (!(await requirePersonInScope(q, r, q.params.id))) return;
  const { formId } = z.object({ formId: z.string().min(1) }).parse(q.body);
  const removed = await db.registrationInvitation.deleteMany({ where: { userId: q.params.id, formId } });
  if (!removed.count) return r.status(404).json({ error: "Invitation not found or already reverted" });
  await db.auditLog.create({ data: { action: "REGISTRATION_INVITATION_REVERTED", actorId: q.user!.id, metadata: { userId: q.params.id, formId } } });
  r.status(204).end();
});
const importedAccount = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z
      .union([z.string().trim().toLowerCase().email(), z.literal("")])
      .default(""),
    role: z.nativeEnum(Role).default(Role.DADE),
    contact: z.string().trim().max(40).optional().default(""),
    area: z.string().trim().max(120).optional().default(""),
    labels: z.string().optional().default(""),
    organization: z.string().optional().default(""),
    harmony: z.string().optional().default(""),
    mutualLove: z.string().optional().default(""),
    cooperation: z.string().optional().default(""),
    organizationLevel: organizationLevelInput
      .nullable()
      .optional()
      .default(null),
    locked: z.boolean().optional().default(false),
    suspended: z.boolean().optional().default(false),
    password: z.string().min(8).optional(),
  })
  .refine((row) => Boolean(row.email || loginEmailForContact(row.contact)), {
    message: "Email or valid contact is required",
    path: ["email"],
  });
app.post(
  "/api/admin/accounts/import",
  auth([Role.ADMIN]),
  async (q: Req, r) => {
    const scope = await requirePeopleScope(q, r);
    if (!scope) return;
    const rows = z.array(importedAccount).min(1).max(1000).parse(q.body?.users),
      [departments, harmonies, mutualLoves, cooperations] = await Promise.all([
        db.department.findMany(),
        db.harmonyGroup.findMany(),
        db.mutualLoveGroup.findMany(),
        db.cooperationUnit.findMany(),
      ]),
      find = (items: any[], name: string) =>
        items.find(
          (item) =>
            item.name.trim().toLowerCase() === name.trim().toLowerCase(),
        )?.id;
    let created = 0,
      updated = 0;
    const errors: string[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      try {
        if (!scope.admin && row.role === Role.ADMIN)
          throw new Error("Only administrators can assign the Administrator role");
        const generatedEmail = loginEmailForContact(row.contact),
          email = row.email || generatedEmail;
        let current = await db.user.findUnique({
          where: { email },
          select: { id: true, email: true },
        });
        if (!current && normalizeLoginContact(row.contact).length >= 7) {
          const candidates = await db.user.findMany({
              where: { phone: { not: null } },
              select: { id: true, email: true, phone: true },
            }),
            matches = candidates.filter((candidate) =>
              isContactMatch(row.contact, candidate.phone),
            );
          if (matches.length > 1)
            throw new Error("Contact number belongs to multiple accounts");
          current = matches[0] || null;
        }
        if (current && !scope.admin) {
          const scopedTarget = await db.user.findFirst({ where: { id: current.id, ...scope.where }, select: { id: true } });
          if (!scopedTarget) throw new Error("Account is outside your Harmony and MutualLove scope");
        }
        const labels = [
            ...new Set(
              row.labels
                .split("|")
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ].slice(0, 20),
          data = {
            name: row.name,
            phone: row.contact || null,
            stayArea: row.area || null,
            labels,
            organizationLevel: row.organizationLevel,
            role: row.role,
            roles: [row.role],
            locked: row.locked,
            suspended: row.suspended,
            departmentId: row.organization
              ? find(departments, row.organization)
              : null,
            harmonyGroupId: scope.admin ? (row.harmony ? find(harmonies, row.harmony) : null) : scope.harmonyGroupId,
            mutualLoveGroupId: scope.admin ? (row.mutualLove ? find(mutualLoves, row.mutualLove) : null) : scope.mutualLoveGroupId,
            cooperationUnitId: row.cooperation
              ? find(cooperations, row.cooperation)
              : null,
          };
        if (current) {
          if (current.id === q.user!.id && (data.locked || data.suspended))
            throw new Error("Cannot deactivate the signed-in administrator");
          await db.user.update({ where: { id: current.id }, data });
          updated++;
        } else {
          await db.user.create({
            data: {
              ...data,
              email,
              password: await bcrypt.hash(row.password || "Demo123!", 12),
            },
          });
          created++;
        }
      } catch (error: any) {
        errors.push(`Row ${index + 2}: ${error?.message || "Import failed"}`);
      }
    }
    await db.auditLog.create({
      data: {
        action: "USERS_IMPORTED",
        actorId: q.user!.id,
        metadata: { created, updated, errors: errors.length },
      },
    });
    r.json({ created, updated, errors });
  },
);
app.use("/api/registrations", createRegistrationRouter(db, secret));
app.use("/api/me/reader-account", createReaderProfileRouter(db, secret));
app.get("/api/public/areas", async (_q, r) =>
  r.json(
    await db.area.findMany({
      select: {
        id: true,
        name: true,
        mutualLove: {
          select: {
            id: true,
            name: true,
            harmony: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ),
);
app.get("/api/areas", auth(), async (_q, r) =>
  r.json(
    await db.area.findMany({
      select: {
        id: true,
        name: true,
        mutualLove: {
          select: {
            id: true,
            name: true,
            harmony: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ),
);
app.use("/api/admin/areas", createAreaRouter(db, secret));
app.use("/api/role-menus", createRoleMenuRouter(db, secret));
const openapi = {
  openapi: "3.0.3",
  info: { title: "Local News Channel API", version: "1.0.0" },
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        responses: { "200": { description: "Healthy" } },
      },
    },
    "/api/articles": {
      get: {
        summary: "List published articles",
        responses: { "200": { description: "Article list" } },
      },
      post: {
        summary: "Create an article",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/auth/login": {
      post: {
        summary: "Sign in",
        responses: { "200": { description: "JWT token" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
const dist = path.resolve("dist");
app.get("/stories/:slug", async (q, r, next) => {
  try {
    const article = await db.article.findFirst({
      where: {
        slug: q.params.slug,
        status: ArticleStatus.PUBLISHED,
        isPublic: true,
      },
      select: {
        title: true,
        excerpt: true,
        content: true,
        imageUrl: true,
        photos: {
          select: { url: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!article) return next();
    const forwardedHost = q.get("x-forwarded-host")?.split(",")[0].trim();
    const origin = `${q.protocol}://${forwardedHost || q.get("host")}`;
    const storyUrl = storySocialUrl(q.params.slug, origin, q.query.preview);
    const photo = article.photos.find((item) => !isVideoUploadUrl(item.url))?.url || article.imageUrl;
    const image = photo
      ? absoluteWebUrl(photo, origin)
      : youtubeThumbnailFromText(article.content);
    const videoUpload = article.photos.find((item) => isVideoUploadUrl(item.url))?.url;
    const video = videoUpload ? absoluteWebUrl(videoUpload, origin) : "";
    const description = plainText(article.excerpt || article.content).slice(0, 240) || "Read this story on Local News.";
    const html = await fs.readFile(path.join(dist, "index.html"), "utf8");
    r.set("Cache-Control", "public, max-age=60, s-maxage=300");
    r.type("html").send(injectSocialMeta(html, {
      title: article.title,
      description,
      url: storyUrl,
      image,
      video,
    }));
  } catch (error) {
    next(error);
  }
});
app.use(express.static(dist));
app.use((q, r, next) =>
  q.path.startsWith("/api/")
    ? next()
    : r.sendFile(path.join(dist, "index.html")),
);
app.use(
  (
    e: any,
    _q: express.Request,
    r: express.Response,
    _n: express.NextFunction,
  ) => {
    console.error(e);
    r.status(e?.name === "ZodError" ? 400 : 500).json({
      error: e?.name === "ZodError" ? "Invalid request" : "Server error",
      details: e?.issues,
    });
  },
);
const migrateLegacyArticlePhotos = async () => {
  const legacy = await db.article.findMany({
    where: { imageUrl: { not: null }, photos: { none: {} } },
    select: { id: true, imageUrl: true },
  });
  for (const article of legacy)
    await db.articlePhoto.create({
      data: { articleId: article.id, url: article.imageUrl!, sortOrder: 0 },
    });
};
const port = Number(process.env.PORT || 4000);
migrateLegacyArticlePhotos()
  .then(async () => {
    await expirePublishedArticles();
    const expiryTimer = setInterval(
      () =>
        expirePublishedArticles().catch((error) =>
          console.error("Could not expire published stories", error),
        ),
      60 * 60 * 1000,
    );
    expiryTimer.unref();
    app.listen(port, "0.0.0.0", () => console.log(`Local News API on ${port}`));
  })
  .catch((error) => {
    console.error("Could not start Local News API", error);
    process.exit(1);
  });
