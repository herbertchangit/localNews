import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  areaWhereForHarmony,
  mutualLoveWhereForHarmony,
} from "./areaHarmony.js";

const areaInput = z.object({
  name: z.string().trim().min(2).max(120),
  mutualLoveId: z.string().min(1),
});

const areaSelect = {
  id: true,
  name: true,
  mutualLoveId: true,
  createdAt: true,
  updatedAt: true,
  mutualLove: { select: { id: true, name: true, harmony: { select: { id: true, name: true } } } },
};

export function createAreaRouter(db: any, secret: string) {
  const router = express.Router();
  const admin = (req: any, res: any, next: any) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const user = token ? jwt.verify(token, secret) as any : null;
      if (!user) return res.status(401).json({ error: "Authentication required" });
      if (user.role !== "ADMIN" && !user.roles?.includes("ADMIN") && !req.roleAuthorityConfigured) return res.status(403).json({ error: "Administrator access required" });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
  const userHarmonyId = async (userId: string) =>
    (await db.user.findUnique({
      where: { id: userId },
      select: { harmonyGroupId: true },
    }))?.harmonyGroupId || null;
  const mutualLoveExists = async (id: string, harmonyGroupId: string | null) =>
    Boolean(
      await db.mutualLoveGroup.findFirst({
        where: { id, ...mutualLoveWhereForHarmony(harmonyGroupId) },
        select: { id: true },
      }),
    );
  const duplicateMessage = (error: any) => error?.code === "P2002" ? "An area with this name already exists" : null;

  router.get("/", admin, async (req: any, res) => {
    const harmonyGroupId = await userHarmonyId(req.user.id);
    res.json(await db.area.findMany({ where: areaWhereForHarmony(harmonyGroupId), select: areaSelect, orderBy: [{ name: "asc" }] }));
  });

  router.get("/options", admin, async (req: any, res) => {
    const harmonyGroupId = await userHarmonyId(req.user.id);
    res.json(await db.harmonyGroup.findMany({
      where: harmonyGroupId ? { id: harmonyGroupId } : { id: { in: [] } },
      select: {
        id: true,
        name: true,
        mutualLoves: {
          where: mutualLoveWhereForHarmony(harmonyGroupId),
          select: { id: true, name: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }));
  });

  router.post("/", admin, async (req: any, res) => {
    const data = areaInput.parse(req.body);
    const harmonyGroupId = await userHarmonyId(req.user.id);
    if (!await mutualLoveExists(data.mutualLoveId, harmonyGroupId)) return res.status(400).json({ error: "Select a MutualLove group from your Harmony" });
    try {
      const area = await db.area.create({ data, select: areaSelect });
      await db.auditLog.create({ data: { action: "AREA_CREATED", actorId: req.user.id, metadata: { areaId: area.id, name: area.name, mutualLoveId: area.mutualLoveId } } });
      res.status(201).json(area);
    } catch (error: any) {
      const message = duplicateMessage(error);
      if (message) return res.status(409).json({ error: message });
      throw error;
    }
  });

  router.patch("/:id", admin, async (req: any, res) => {
    const data = areaInput.parse(req.body);
    const harmonyGroupId = await userHarmonyId(req.user.id);
    if (!await mutualLoveExists(data.mutualLoveId, harmonyGroupId)) return res.status(400).json({ error: "Select a MutualLove group from your Harmony" });
    if (!await db.area.findFirst({ where: { id: req.params.id, ...areaWhereForHarmony(harmonyGroupId) }, select: { id: true } })) return res.status(404).json({ error: "Area not found" });
    try {
      const area = await db.area.update({ where: { id: req.params.id }, data, select: areaSelect });
      await db.auditLog.create({ data: { action: "AREA_UPDATED", actorId: req.user.id, metadata: { areaId: area.id, name: area.name, mutualLoveId: area.mutualLoveId } } });
      res.json(area);
    } catch (error: any) {
      const message = duplicateMessage(error);
      if (message) return res.status(409).json({ error: message });
      throw error;
    }
  });

  router.delete("/:id", admin, async (req: any, res) => {
    const harmonyGroupId = await userHarmonyId(req.user.id);
    const area = await db.area.findFirst({ where: { id: req.params.id, ...areaWhereForHarmony(harmonyGroupId) }, select: { id: true, name: true } });
    if (!area) return res.status(404).json({ error: "Area not found" });
    await db.area.delete({ where: { id: area.id } });
    await db.auditLog.create({ data: { action: "AREA_DELETED", actorId: req.user.id, metadata: { areaId: area.id, name: area.name } } });
    res.status(204).end();
  });

  return router;
}
