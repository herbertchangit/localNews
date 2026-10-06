import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { isContactMatch, normalizeLoginContact } from "./loginIdentifier.js";
import {
  areaWhereForHarmony,
  mutualLoveWhereForHarmony,
} from "./areaHarmony.js";

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  stayArea: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  harmonyGroup: true,
  mutualLoveGroup: true,
  cooperationUnit: true,
};

const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  contact: z.string().trim().max(40),
  stayArea: z.string().trim().min(2).max(120),
  harmonyGroupId: z.string().nullable(),
  mutualLoveGroupId: z.string().nullable(),
  cooperationUnitId: z.string().nullable(),
}).refine((value) => !value.contact || normalizeLoginContact(value.contact).length >= 7, {
  message: "Contact number must contain at least 7 digits",
  path: ["contact"],
});
const contactInput = z.object({ contact: z.string().trim().max(40) }).refine(
  (value) => !value.contact || normalizeLoginContact(value.contact).length >= 7,
  { message: "Contact number must contain at least 7 digits", path: ["contact"] },
);

export function createReaderProfileRouter(db: any, secret: string) {
  const router = express.Router();
  const authenticate = (req: any, res: any, next: any) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Authentication required" });
      req.user = jwt.verify(token, secret);
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };

  router.get("/", authenticate, async (req: any, res) => {
    const user = await db.user.findUnique({ where: { id: req.user.id }, select: profileSelect });
    user ? res.json(user) : res.status(404).json({ error: "User not found" });
  });

  router.get("/options", authenticate, async (req: any, res) => {
    const current = await db.user.findUnique({
      where: { id: req.user.id },
      select: { harmonyGroupId: true },
    });
    if (!current) return res.status(404).json({ error: "User not found" });
    const harmonyGroupId = current.harmonyGroupId;
    const [structure, areas] = await Promise.all([
      db.harmonyGroup.findMany({
        where: harmonyGroupId ? { id: harmonyGroupId } : { id: { in: [] } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          mutualLoves: {
            where: mutualLoveWhereForHarmony(harmonyGroupId),
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: {
              cooperations: {
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
              },
            },
          },
        },
      }),
      db.area.findMany({
        where: areaWhereForHarmony(harmonyGroupId),
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
    ]);
    res.json({ structure, areas });
  });

  router.patch("/contact", authenticate, async (req: any, res) => {
    const { contact } = contactInput.parse(req.body);
    if (contact) {
      const candidates = await db.user.findMany({ where: { id: { not: req.user.id }, phone: { not: null } }, select: { id: true, phone: true } });
      if (candidates.some((candidate: any) => isContactMatch(contact, candidate.phone))) {
        return res.status(409).json({ error: "That contact number is already in use" });
      }
    }
    const user = await db.user.update({ where: { id: req.user.id }, data: { phone: contact || null }, select: { phone: true } });
    await db.auditLog.create({ data: { action: "CONTACT_UPDATED", actorId: req.user.id } });
    res.json(user);
  });

  router.patch("/", authenticate, async (req: any, res) => {
    const data = profileInput.parse(req.body);
    const current = await db.user.findUnique({
      where: { id: req.user.id },
      select: { harmonyGroupId: true },
    });
    if (!current) return res.status(404).json({ error: "User not found" });
    if (data.harmonyGroupId !== current.harmonyGroupId)
      return res.status(403).json({ error: "Harmony can only be changed by an administrator" });
    const stayArea = await db.area.findFirst({
      where: {
        name: data.stayArea,
        ...areaWhereForHarmony(current.harmonyGroupId),
      },
      select: { id: true },
    });
    if (!stayArea)
      return res.status(400).json({ error: "Select a Stay area from your Harmony" });
    if (await db.user.findFirst({ where: { email: data.email, NOT: { id: req.user.id } }, select: { id: true } })) {
      return res.status(409).json({ error: "That email is already in use" });
    }
    if (data.contact) {
      const candidates = await db.user.findMany({ where: { id: { not: req.user.id }, phone: { not: null } }, select: { id: true, phone: true } });
      if (candidates.some((candidate: any) => isContactMatch(data.contact, candidate.phone))) {
        return res.status(409).json({ error: "That contact number is already in use" });
      }
    }
    if (data.mutualLoveGroupId) {
      const mutual = await db.mutualLoveGroup.findFirst({ where: { id: data.mutualLoveGroupId, ...mutualLoveWhereForHarmony(current.harmonyGroupId) } });
      if (!mutual) return res.status(400).json({ error: "MutualLove does not belong to your Harmony" });
    }
    if (data.cooperationUnitId) {
      const unit = await db.cooperationUnit.findUnique({ where: { id: data.cooperationUnitId } });
      if (!unit || unit.mutualLoveId !== data.mutualLoveGroupId) return res.status(400).json({ error: "Cooperation does not belong to the selected MutualLove" });
    }
    const { contact, ...profile } = data;
    const user = await db.user.update({ where: { id: req.user.id }, data: { ...profile, phone: contact || null }, select: profileSelect });
    await db.auditLog.create({ data: { action: "READER_PROFILE_UPDATED", actorId: req.user.id, metadata: { changes: Object.keys(data), hierarchy: [user.harmonyGroup?.name, user.mutualLoveGroup?.name, user.cooperationUnit?.name] } } });
    res.json(user);
  });

  return router;
}
