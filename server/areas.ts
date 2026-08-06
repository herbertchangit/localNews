import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

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
      if (user.role !== "ADMIN") return res.status(403).json({ error: "Administrator access required" });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
  const mutualLoveExists = async (id: string) => Boolean(await db.mutualLoveGroup.findUnique({ where: { id }, select: { id: true } }));
  const duplicateMessage = (error: any) => error?.code === "P2002" ? "An area with this name already exists" : null;

  router.get("/", admin, async (_req, res) => {
    res.json(await db.area.findMany({ select: areaSelect, orderBy: [{ name: "asc" }] }));
  });

  router.post("/", admin, async (req: any, res) => {
    const data = areaInput.parse(req.body);
    if (!await mutualLoveExists(data.mutualLoveId)) return res.status(400).json({ error: "Selected MutualLove group was not found" });
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
    if (!await mutualLoveExists(data.mutualLoveId)) return res.status(400).json({ error: "Selected MutualLove group was not found" });
    if (!await db.area.findUnique({ where: { id: req.params.id }, select: { id: true } })) return res.status(404).json({ error: "Area not found" });
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
    const area = await db.area.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
    if (!area) return res.status(404).json({ error: "Area not found" });
    await db.area.delete({ where: { id: area.id } });
    await db.auditLog.create({ data: { action: "AREA_DELETED", actorId: req.user.id, metadata: { areaId: area.id, name: area.name } } });
    res.status(204).end();
  });

  return router;
}
