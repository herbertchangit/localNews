import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";

const parkingPassInput = z.object({
  visitorName: z.string().trim().min(2).max(100),
  mobileNumber: z.string().trim().min(7).max(30).refine(
    (value) => value.replace(/\D/g, "").length >= 7,
    "Enter a valid mobile number",
  ),
  carPlateNumber: z.string().trim().min(2).max(20).transform((value) =>
    value.toUpperCase().replace(/\s+/g, " "),
  ),
  active: z.boolean().optional(),
});

const passSelect = {
  id: true,
  publicToken: true,
  visitorName: true,
  mobileNumber: true,
  carPlateNumber: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  issuedBy: { select: { id: true, name: true } },
} as const;

export function createParkingPassRouter(
  db: PrismaClient,
  authenticate: RequestHandler,
) {
  const router = Router();

  router.get("/", authenticate, async (_req, res) => {
    res.json(await db.parkingPass.findMany({
      select: passSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
  });

  router.post("/", authenticate, async (req: any, res) => {
    const data = parkingPassInput.parse(req.body);
    const pass = await db.parkingPass.create({
      data: {
        ...data,
        publicToken: randomBytes(24).toString("hex"),
        issuedById: req.user.id,
      },
      select: passSelect,
    });
    await db.auditLog.create({
      data: {
        action: "PARKING_PASS_ISSUED",
        actorId: req.user.id,
        metadata: { parkingPassId: pass.id, carPlateNumber: pass.carPlateNumber },
      },
    });
    res.status(201).json(pass);
  });

  router.patch("/:id", authenticate, async (req: any, res) => {
    const data = parkingPassInput.partial().parse(req.body);
    const existing = await db.parkingPass.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Parking pass not found" });
    const pass = await db.parkingPass.update({
      where: { id: existing.id },
      data,
      select: passSelect,
    });
    await db.auditLog.create({
      data: {
        action: "PARKING_PASS_UPDATED",
        actorId: req.user.id,
        metadata: { parkingPassId: pass.id, active: pass.active },
      },
    });
    res.json(pass);
  });

  router.delete("/:id", authenticate, async (req: any, res) => {
    const existing = await db.parkingPass.findUnique({
      where: { id: String(req.params.id) },
      select: { id: true, carPlateNumber: true },
    });
    if (!existing) return res.status(404).json({ error: "Parking pass not found" });
    await db.parkingPass.delete({ where: { id: existing.id } });
    await db.auditLog.create({
      data: {
        action: "PARKING_PASS_DELETED",
        actorId: req.user.id,
        metadata: { parkingPassId: existing.id, carPlateNumber: existing.carPlateNumber },
      },
    });
    res.status(204).end();
  });

  return router;
}

export function createPublicParkingPassRouter(db: PrismaClient) {
  const router = Router();
  router.get("/:token", async (req, res) => {
    const pass = await db.parkingPass.findUnique({
      where: { publicToken: String(req.params.token) },
      select: passSelect,
    });
    if (!pass) return res.status(404).json({ error: "Parking pass not found" });
    res.json(pass);
  });
  return router;
}
