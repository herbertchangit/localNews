import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { HealthAppointmentStatus, PrismaClient, Role } from "@prisma/client";
import { z } from "zod";
import { isContactMatch } from "./loginIdentifier.js";

const eventSelect = {
  doctors: { include: { doctor: { include: { user: { select: { id: true, name: true, email: true } } } } } },
  _count: { select: { appointments: true, timeSlots: true } },
};
const doctorSelect = {
  user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true, suspended: true } },
  _count: { select: { appointments: true, eventAssignments: true } },
};
const appointmentSelect = {
  patient: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
  doctor: { include: { user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } } } },
  event: { select: { id: true, name: true, eventDate: true, location: true, address: true } },
};

const eventInput = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(4000),
  location: z.string().trim().min(2).max(200),
  address: z.string().trim().min(2).max(400),
  mapsUrl: z.string().url().nullable().optional(),
  wazeUrl: z.string().url().nullable().optional(),
  eventDate: z.coerce.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  bannerImage: z.string().max(8_000_000).refine((value) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value) || /^https?:\/\//i.test(value) || value.startsWith("/uploads/"), "Use a PNG, JPEG, or WebP event photo").nullable().optional(),
  maxCapacity: z.coerce.number().int().min(1).max(100000),
  active: z.boolean().default(true),
  publishedToStoryBoard: z.boolean().default(false),
  doctorIds: z.array(z.string()).default([]),
});
const dutySlot = z.object({
  day_of_week: z.string().min(2),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  slot_duration_minutes: z.coerce.number().int().min(5).max(240),
});
const doctorCreateInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).nullable().optional(),
  password: z.string().min(8).max(72),
  specialization: z.string().trim().min(2).max(160),
  qualification: z.string().trim().min(2).max(240),
  experienceYears: z.coerce.number().int().min(0).max(80),
  bio: z.string().trim().max(4000).nullable().optional(),
  profileImage: z.string().nullable().optional(),
  consultationFee: z.coerce.number().min(0).max(1000000),
  dutySlots: z.array(dutySlot).default([]),
});
const doctorUpdateInput = doctorCreateInput.partial().omit({ password: true });
const appointmentInput = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  eventId: z.string().min(1),
  slotId: z.string().min(1).nullable().optional(),
  patientName: z.string().trim().min(2).max(120).optional(),
  patientPhone: z.string().trim().max(40).nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(1000).nullable().optional(),
  status: z.nativeEnum(HealthAppointmentStatus).default(HealthAppointmentStatus.CONFIRMED),
});
const timeValue = z.string().regex(/^\d{2}:\d{2}$/);
const doctorSlotBulkInput = z.object({
  eventId: z.string().min(1),
  startTime: timeValue,
  endTime: timeValue,
  slotDurationMinutes: z.coerce.number().int().min(5).max(240),
});
const doctorSlotUpdateInput = z.object({
  startTime: timeValue,
  endTime: timeValue,
});
const minutesFromTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};
const timeFromMinutes = (value: number) =>
  `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
const overlaps = (start: number, end: number, otherStart: string, otherEnd: string) =>
  start < minutesFromTime(otherEnd) && end > minutesFromTime(otherStart);

export function createHealthAdminRouter(db: PrismaClient, secret: string) {
  const router = express.Router();
  router.use((req: any, res, next) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Authentication required" });
      req.user = jwt.verify(token, secret);
      if (![Role.ADMIN, Role.ADMIN_MEDICAL].includes(req.user.role)) return res.status(403).json({ error: "Medical administrator access required" });
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  router.get("/events", async (_req, res) => {
    res.json(await db.healthEvent.findMany({ include: eventSelect, orderBy: [{ eventDate: "desc" }, { startTime: "asc" }] }));
  });
  router.post("/events", async (req: any, res) => {
    const { doctorIds, ...data } = eventInput.parse(req.body);
    const event = await db.healthEvent.create({
      data: { ...data, creatorId: req.user.id, doctors: { create: doctorIds.map((doctorId) => ({ doctorId })) } },
      include: eventSelect,
    });
    await db.auditLog.create({ data: { action: "HEALTH_EVENT_CREATED", actorId: req.user.id, metadata: { eventId: event.id } } });
    res.status(201).json(event);
  });
  router.patch("/events/:id", async (req: any, res) => {
    const parsed = eventInput.partial().parse(req.body);
    const { doctorIds, ...data } = parsed;
    if (!await db.healthEvent.findUnique({ where: { id: req.params.id } })) return res.status(404).json({ error: "Event not found" });
    const event = await db.$transaction(async (tx) => {
      if (doctorIds) {
        await tx.healthEventDoctor.deleteMany({ where: { eventId: req.params.id } });
        if (doctorIds.length) await tx.healthEventDoctor.createMany({ data: doctorIds.map((doctorId) => ({ eventId: req.params.id, doctorId })) });
      }
      return tx.healthEvent.update({ where: { id: req.params.id }, data, include: eventSelect });
    });
    await db.auditLog.create({ data: { action: "HEALTH_EVENT_UPDATED", actorId: req.user.id, metadata: { eventId: event.id } } });
    res.json(event);
  });
  router.delete("/events/:id", async (req: any, res) => {
    const current = await db.healthEvent.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
    if (!current) return res.status(404).json({ error: "Event not found" });
    await db.healthEvent.delete({ where: { id: current.id } });
    await db.auditLog.create({ data: { action: "HEALTH_EVENT_DELETED", actorId: req.user.id, metadata: { eventId: current.id, name: current.name } } });
    res.status(204).end();
  });

  router.get("/doctors", async (_req, res) => {
    res.json(await db.doctorProfile.findMany({ include: doctorSelect, orderBy: { user: { name: "asc" } } }));
  });
  router.post("/doctors", async (req: any, res) => {
    const data = doctorCreateInput.parse(req.body);
    if (await db.user.findUnique({ where: { email: data.email } })) return res.status(409).json({ error: "That email is already registered" });
    const doctor = await db.doctorProfile.create({
      data: {
        specialization: data.specialization,
        qualification: data.qualification,
        experienceYears: data.experienceYears,
        bio: data.bio,
        profileImage: data.profileImage,
        consultationFee: data.consultationFee,
        dutySlots: data.dutySlots,
        user: { create: { name: data.name, email: data.email, phone: data.phone, password: await bcrypt.hash(data.password, 12), role: Role.DOCTOR } },
      },
      include: doctorSelect,
    });
    await db.auditLog.create({ data: { action: "DOCTOR_CREATED", actorId: req.user.id, metadata: { doctorId: doctor.id, userId: doctor.userId } } });
    res.status(201).json(doctor);
  });
  router.patch("/doctors/:id", async (req: any, res) => {
    const data = doctorUpdateInput.parse(req.body);
    const current = await db.doctorProfile.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true } });
    if (!current) return res.status(404).json({ error: "Doctor not found" });
    if (data.email) {
      const duplicate = await db.user.findFirst({ where: { email: data.email, id: { not: current.userId } } });
      if (duplicate) return res.status(409).json({ error: "That email is already registered" });
    }
    const doctor = await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: current.userId }, data: { name: data.name, email: data.email, phone: data.phone } });
      return tx.doctorProfile.update({
        where: { id: current.id },
        data: {
          specialization: data.specialization,
          qualification: data.qualification,
          experienceYears: data.experienceYears,
          bio: data.bio,
          profileImage: data.profileImage,
          consultationFee: data.consultationFee,
          dutySlots: data.dutySlots,
        },
        include: doctorSelect,
      });
    });
    await db.auditLog.create({ data: { action: "DOCTOR_UPDATED", actorId: req.user.id, metadata: { doctorId: doctor.id } } });
    res.json(doctor);
  });
  router.delete("/doctors/:id", async (req: any, res) => {
    const current = await db.doctorProfile.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true } });
    if (!current) return res.status(404).json({ error: "Doctor not found" });
    await db.$transaction([db.user.update({ where: { id: current.userId }, data: { role: Role.DADE } }), db.doctorProfile.delete({ where: { id: current.id } })]);
    await db.auditLog.create({ data: { action: "DOCTOR_DELETED", actorId: req.user.id, metadata: { doctorId: current.id, userId: current.userId } } });
    res.status(204).end();
  });

  router.get("/appointments", async (_req, res) => {
    const appointments = await db.healthAppointment.findMany({ include: appointmentSelect });
    appointments.sort((left, right) =>
      left.doctor.user.name.localeCompare(right.doctor.user.name, undefined, { sensitivity: "base" })
      || left.startTime.localeCompare(right.startTime)
      || left.patient.name.localeCompare(right.patient.name, undefined, { sensitivity: "base" }),
    );
    res.json(appointments);
  });
  router.post("/appointments", async (req: any, res) => {
    const data = appointmentInput.parse(req.body);
    const [patient, doctor, event, slot] = await Promise.all([
      db.user.findUnique({ where: { id: data.patientId } }),
      db.doctorProfile.findUnique({ where: { id: data.doctorId } }),
      db.healthEvent.findUnique({ where: { id: data.eventId } }),
      data.slotId ? db.healthTimeSlot.findUnique({ where: { id: data.slotId } }) : null,
    ]);
    if (!patient || !doctor || !event) return res.status(400).json({ error: "Select a valid patient, doctor, and event" });
    if (!slot || slot.eventId !== event.id || slot.doctorId !== doctor.id) return res.status(400).json({ error: "Select an available appointment slot for this doctor" });
    if (slot.booked) return res.status(409).json({ error: "This appointment slot is no longer available" });
    const appointment = await db.$transaction(async (tx) => {
      const reserved = await tx.healthTimeSlot.updateMany({ where: { id: slot.id, booked: false }, data: { booked: true } });
      if (!reserved.count) throw new Error("APPOINTMENT_SLOT_TAKEN");
      return tx.healthAppointment.create({
        data: { ...data, slotId: slot.id, startTime: slot.startTime, endTime: slot.endTime, patientName: data.patientName || patient.name, patientPhone: data.patientPhone ?? patient.phone },
        include: appointmentSelect,
      });
    });
    await db.auditLog.create({ data: { action: "HEALTH_APPOINTMENT_CREATED", actorId: req.user.id, metadata: { appointmentId: appointment.id } } });
    res.status(201).json(appointment);
  });
  router.patch("/appointments/:id", async (req: any, res) => {
    const data = appointmentInput.partial().parse(req.body);
    const current = await db.healthAppointment.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Appointment not found" });
    const slotId = data.slotId === undefined ? current.slotId : data.slotId;
    if (!slotId) return res.status(400).json({ error: "Select an available appointment slot for this doctor" });
    const slot = await db.healthTimeSlot.findUnique({ where: { id: slotId } });
    const eventId = data.eventId || current.eventId, doctorId = data.doctorId || current.doctorId;
    if (!slot || slot.eventId !== eventId || slot.doctorId !== doctorId) return res.status(400).json({ error: "Select an available appointment slot for this doctor" });
    if (slot.booked && slot.id !== current.slotId) return res.status(409).json({ error: "This appointment slot is no longer available" });
    const appointment = await db.$transaction(async (tx) => {
      if (current.slotId !== slot.id) {
        const reserved = await tx.healthTimeSlot.updateMany({ where: { id: slot.id, booked: false }, data: { booked: true } });
        if (!reserved.count) throw new Error("APPOINTMENT_SLOT_TAKEN");
        if (current.slotId) await tx.healthTimeSlot.update({ where: { id: current.slotId }, data: { booked: false } });
      }
      return tx.healthAppointment.update({ where: { id: current.id }, data: { ...data, slotId: slot.id, startTime: slot.startTime, endTime: slot.endTime }, include: appointmentSelect });
    });
    await db.auditLog.create({ data: { action: "HEALTH_APPOINTMENT_UPDATED", actorId: req.user.id, metadata: { appointmentId: appointment.id } } });
    res.json(appointment);
  });
  router.delete("/appointments/:id", async (req: any, res) => {
    const current = await db.healthAppointment.findUnique({ where: { id: req.params.id }, select: { id: true, slotId: true } });
    if (!current) return res.status(404).json({ error: "Appointment not found" });
    await db.$transaction(async (tx) => {
      await tx.healthAppointment.delete({ where: { id: current.id } });
      if (current.slotId) await tx.healthTimeSlot.update({ where: { id: current.slotId }, data: { booked: false } });
    });
    await db.auditLog.create({ data: { action: "HEALTH_APPOINTMENT_DELETED", actorId: req.user.id, metadata: { appointmentId: current.id } } });
    res.status(204).end();
  });

  router.get("/options", async (_req, res) => {
    const [patients, doctors, events, timeSlots] = await Promise.all([
      db.user.findMany({ where: { role: { in: [Role.DADE, Role.AUDIENCE] }, suspended: false }, select: { id: true, name: true, email: true, phone: true }, orderBy: { name: "asc" } }),
      db.doctorProfile.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: { user: { name: "asc" } } }),
      db.healthEvent.findMany({ select: { id: true, name: true, eventDate: true, startTime: true, endTime: true, active: true }, orderBy: { eventDate: "desc" } }),
      db.healthTimeSlot.findMany({ select: { id: true, eventId: true, doctorId: true, startTime: true, endTime: true, booked: true }, orderBy: { startTime: "asc" } }),
    ]);
    res.json({ patients, doctors, events, timeSlots, statuses: Object.values(HealthAppointmentStatus) });
  });

  return router;
}

export function createHealthDoctorRouter(db: PrismaClient, secret: string) {
  const router = express.Router();
  router.use((req: any, res, next) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Authentication required" });
      req.user = jwt.verify(token, secret);
      if (req.user.role !== Role.DOCTOR) return res.status(403).json({ error: "Doctor access required" });
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  const profileFor = async (userId: string) => {
    const user = await db.user.findFirst({
      where: { id: userId, role: Role.DOCTOR, suspended: false },
      select: { id: true },
    });
    if (!user) return null;
    return db.doctorProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        specialization: "General Practice",
        qualification: "Profile pending",
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  };

  router.get("/settings", async (req: any, res) => {
    const profile = await profileFor(req.user.id);
    if (!profile) return res.status(404).json({ error: "Doctor profile not found" });
    const assignments = await db.healthEventDoctor.findMany({
      where: { doctorId: profile.id },
      include: {
        event: {
          include: {
            timeSlots: {
              where: { doctorId: profile.id },
              orderBy: { startTime: "asc" },
            },
          },
        },
      },
      orderBy: { event: { eventDate: "desc" } },
    });
    res.json({ profile, events: assignments.map(({ event }) => event) });
  });

  router.get("/appointments", async (req: any, res) => {
    const profile = await profileFor(req.user.id);
    if (!profile) return res.status(404).json({ error: "Doctor profile not found" });
    const appointments = await db.healthAppointment.findMany({
      where: { doctorId: profile.id },
      include: appointmentSelect,
      orderBy: [{ event: { eventDate: "desc" } }, { startTime: "asc" }],
    });
    res.json(appointments);
  });

  router.patch("/appointments/:id/complete", async (req: any, res) => {
    const profile = await profileFor(req.user.id);
    if (!profile) return res.status(404).json({ error: "Doctor profile not found" });
    const appointment = await db.healthAppointment.findFirst({
      where: { id: req.params.id, doctorId: profile.id },
      select: { id: true, status: true },
    });
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });
    if (appointment.status === HealthAppointmentStatus.COMPLETED) {
      return res.status(409).json({ error: "Appointment is already completed" });
    }
    if (appointment.status !== HealthAppointmentStatus.PENDING && appointment.status !== HealthAppointmentStatus.CONFIRMED) {
      return res.status(409).json({ error: "Only pending or confirmed appointments can be completed" });
    }
    const updated = await db.healthAppointment.update({
      where: { id: appointment.id },
      data: { status: HealthAppointmentStatus.COMPLETED },
      include: appointmentSelect,
    });
    await db.auditLog.create({
      data: {
        action: "DOCTOR_APPOINTMENT_COMPLETED",
        actorId: req.user.id,
        metadata: { appointmentId: appointment.id, doctorId: profile.id },
      },
    });
    res.json(updated);
  });

  router.post("/slots/bulk", async (req: any, res) => {
    const data = doctorSlotBulkInput.parse(req.body);
    const profile = await profileFor(req.user.id);
    if (!profile) return res.status(404).json({ error: "Doctor profile not found" });
    const assignment = await db.healthEventDoctor.findUnique({
      where: { eventId_doctorId: { eventId: data.eventId, doctorId: profile.id } },
      include: { event: true },
    });
    if (!assignment) return res.status(403).json({ error: "You are not assigned to this event" });
    const start = minutesFromTime(data.startTime);
    const end = minutesFromTime(data.endTime);
    const eventStart = minutesFromTime(assignment.event.startTime);
    const eventEnd = minutesFromTime(assignment.event.endTime);
    if (start >= end) return res.status(400).json({ error: "End time must be later than start time" });
    if (start < eventStart || end > eventEnd) return res.status(400).json({ error: `Slots must be within event hours (${assignment.event.startTime}–${assignment.event.endTime})` });
    const existing = await db.healthTimeSlot.findMany({ where: { eventId: data.eventId, doctorId: profile.id } });
    const candidates: { eventId: string; doctorId: string; startTime: string; endTime: string; slotDurationMinutes: number }[] = [];
    let skipped = 0;
    for (let cursor = start; cursor + data.slotDurationMinutes <= end; cursor += data.slotDurationMinutes) {
      const slotEnd = cursor + data.slotDurationMinutes;
      const conflicts = [...existing, ...candidates].some((slot) => overlaps(cursor, slotEnd, slot.startTime, slot.endTime));
      if (conflicts) {
        skipped += 1;
        continue;
      }
      candidates.push({
        eventId: data.eventId,
        doctorId: profile.id,
        startTime: timeFromMinutes(cursor),
        endTime: timeFromMinutes(slotEnd),
        slotDurationMinutes: data.slotDurationMinutes,
      });
    }
    if (!candidates.length) return res.status(409).json({ error: skipped ? "All generated slots overlap existing slots" : "The selected range is shorter than the slot duration" });
    await db.healthTimeSlot.createMany({ data: candidates });
    const slots = await db.healthTimeSlot.findMany({
      where: { eventId: data.eventId, doctorId: profile.id },
      orderBy: { startTime: "asc" },
    });
    await db.auditLog.create({ data: { action: "DOCTOR_SLOTS_CREATED", actorId: req.user.id, metadata: { eventId: data.eventId, created: candidates.length, skipped } } });
    res.status(201).json({ slots, created: candidates.length, skipped });
  });

  router.patch("/slots/:id", async (req: any, res) => {
    const data = doctorSlotUpdateInput.parse(req.body);
    const profile = await profileFor(req.user.id);
    if (!profile) return res.status(404).json({ error: "Doctor profile not found" });
    const slot = await db.healthTimeSlot.findFirst({
      where: { id: req.params.id, doctorId: profile.id },
      include: { event: true, appointment: { select: { id: true } } },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.booked || slot.appointment) return res.status(409).json({ error: "Booked slots cannot be edited" });
    const start = minutesFromTime(data.startTime);
    const end = minutesFromTime(data.endTime);
    if (start >= end) return res.status(400).json({ error: "End time must be later than start time" });
    if (start < minutesFromTime(slot.event.startTime) || end > minutesFromTime(slot.event.endTime)) return res.status(400).json({ error: `Slots must be within event hours (${slot.event.startTime}–${slot.event.endTime})` });
    const conflict = await db.healthTimeSlot.findFirst({
      where: {
        eventId: slot.eventId,
        doctorId: profile.id,
        id: { not: slot.id },
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime },
      },
      select: { id: true },
    });
    if (conflict) return res.status(409).json({ error: "This time overlaps another appointment slot" });
    const updated = await db.healthTimeSlot.update({
      where: { id: slot.id },
      data: { ...data, slotDurationMinutes: end - start },
    });
    await db.auditLog.create({ data: { action: "DOCTOR_SLOT_UPDATED", actorId: req.user.id, metadata: { slotId: slot.id, eventId: slot.eventId } } });
    res.json(updated);
  });

  router.delete("/slots/:id", async (req: any, res) => {
    const profile = await profileFor(req.user.id);
    if (!profile) return res.status(404).json({ error: "Doctor profile not found" });
    const slot = await db.healthTimeSlot.findFirst({
      where: { id: req.params.id, doctorId: profile.id },
      include: { appointment: { select: { id: true } } },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (slot.booked || slot.appointment) return res.status(409).json({ error: "Booked slots cannot be deleted" });
    await db.healthTimeSlot.delete({ where: { id: slot.id } });
    await db.auditLog.create({ data: { action: "DOCTOR_SLOT_DELETED", actorId: req.user.id, metadata: { slotId: slot.id, eventId: slot.eventId } } });
    res.status(204).end();
  });

  return router;
}

export function createHealthPublicRouter(db: PrismaClient, secret: string) {
  const router = express.Router();
  const publicInclude = {
    doctors: { include: { doctor: { include: { user: { select: { name: true } } } } } },
    timeSlots: {
      where: { booked: false, appointment: null },
      include: { doctor: { include: { user: { select: { name: true } } } } },
      orderBy: { startTime: "asc" as const },
    },
    _count: {
      select: {
        appointments: { where: { status: { not: HealthAppointmentStatus.CANCELLED } } },
      },
    },
  };
  router.get("/", async (_req, res) => {
    const [events, bookingDoctors] = await Promise.all([
      db.healthEvent.findMany({
        where: { active: true, publishedToStoryBoard: true },
        include: publicInclude,
        orderBy: [{ eventDate: "desc" }, { startTime: "asc" }],
      }),
      db.doctorProfile.findMany({
        where: { user: { suspended: false } },
        include: { user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      }),
    ]);
    res.json(events.map((event) => ({ ...event, bookingDoctors })));
  });
  router.get("/appointments/mine", async (req: any, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Authentication required" });
      const user = jwt.verify(token, secret) as { id: string; role: Role };
      const [account, healthAppointments, registrationSubmissions] = await Promise.all([
        db.user.findUnique({ where: { id: user.id }, select: { phone: true } }),
        db.healthAppointment.findMany({
          where: { patientId: user.id },
          include: {
            doctor: { include: { user: { select: { name: true, email: true, phone: true, avatarUrl: true } } } },
            event: { select: { id: true, name: true, eventDate: true, location: true, address: true } },
            slot: { select: { id: true, startTime: true, endTime: true } },
          },
          orderBy: [{ event: { eventDate: "desc" } }, { startTime: "asc" }],
        }),
        db.registrationSubmission.findMany({
          where: { unregisteredAt: null },
          include: { form: true, attendances: { include: { eventDate: true } } },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      const registrationAppointments = account?.phone ? registrationSubmissions
        .filter((submission) => isContactMatch(account.phone!, submission.contact))
        .flatMap((submission) => submission.attendances.map((attendance) => ({
          id: `registration-${attendance.id}`,
          startTime: "Pre-registration",
          endTime: "Confirmed",
          status: "REGISTERED",
          reason: `Total persons: ${attendance.totalPersons} · Meal: ${attendance.meal ? "Yes" : "No"}`,
          createdAt: submission.createdAt,
          event: { id: submission.form.id, name: submission.form.eventName, eventDate: attendance.eventDate.eventDate, location: submission.origin, address: "Event pre-registration" },
          doctor: { specialization: "Registered event date", qualification: "Local News Registration", experienceYears: 0, bio: submission.form.description, profileImage: submission.form.photoUrl, consultationFee: 0, user: { name: "Event Registration", email: "", phone: null, avatarUrl: null } },
        }))) : [];
      res.json([...healthAppointments, ...registrationAppointments].sort((left, right) => new Date(right.event.eventDate).getTime() - new Date(left.event.eventDate).getTime()));
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });
  router.patch("/appointments/:id/cancel", async (req: any, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Authentication required" });
      const user = jwt.verify(token, secret) as { id: string; role: Role };
      const current = await db.healthAppointment.findFirst({
        where: { id: req.params.id, patientId: user.id },
        select: { id: true, slotId: true, status: true, eventId: true },
      });
      if (!current) return res.status(404).json({ error: "Appointment not found" });
      if (current.status === HealthAppointmentStatus.CANCELLED) return res.status(409).json({ error: "This appointment is already cancelled" });
      if (current.status === HealthAppointmentStatus.COMPLETED || current.status === HealthAppointmentStatus.NO_SHOW) {
        return res.status(409).json({ error: "Past appointments cannot be cancelled" });
      }
      const appointment = await db.$transaction(async (tx) => {
        const updated = await tx.healthAppointment.update({
          where: { id: current.id },
          data: { status: HealthAppointmentStatus.CANCELLED, slotId: null },
          include: appointmentSelect,
        });
        if (current.slotId) {
          await tx.healthTimeSlot.update({ where: { id: current.slotId }, data: { booked: false } });
        }
        return updated;
      });
      await db.auditLog.create({
        data: {
          action: "PATIENT_APPOINTMENT_CANCELLED",
          actorId: user.id,
          metadata: { appointmentId: current.id, eventId: current.eventId },
        },
      });
      res.json(appointment);
    } catch (error: any) {
      if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Invalid token" });
      }
      res.status(400).json({ error: error?.message || "Could not cancel appointment" });
    }
  });
  router.post("/:id/appointments", async (req: any, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Sign in to make an appointment" });
      const user = jwt.verify(token, secret) as { id: string; role: Role };
      const body = z.object({
        slotId: z.string().min(1).optional(),
        doctorId: z.string().min(1).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        reason: z.string().trim().max(1000).nullable().optional(),
      }).refine((value) => value.slotId || (value.doctorId && value.startTime && value.endTime), "Choose an available slot or a doctor and preferred time").parse(req.body);
      const patient = await db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true, phone: true, suspended: true } });
      const event = await db.healthEvent.findUnique({ where: { id: req.params.id } });
      const slot = body.slotId ? await db.healthTimeSlot.findFirst({
        where: { id: body.slotId, eventId: req.params.id },
        include: { event: true, appointment: { select: { id: true } } },
      }) : null;
      if (!patient || patient.suspended) return res.status(403).json({ error: "Patient account is unavailable" });
      if (!event?.active || !event.publishedToStoryBoard) return res.status(404).json({ error: "Event is not available for booking" });
      if (body.slotId && !slot) return res.status(404).json({ error: "Appointment slot was not found" });
      if (slot?.booked || slot?.appointment) return res.status(409).json({ error: "That appointment time was just booked. Choose another time." });
      if (await db.healthAppointment.count({
        where: { eventId: event.id, status: { not: HealthAppointmentStatus.CANCELLED } },
      }) >= event.maxCapacity) return res.status(409).json({ error: "This event is fully booked" });
      const directDoctor = !slot && body.doctorId ? await db.doctorProfile.findFirst({ where: { id: body.doctorId, user: { suspended: false } } }) : null;
      if (!slot && !directDoctor) return res.status(400).json({ error: "Choose an available doctor" });
      const requestedDoctorId = slot?.doctorId || directDoctor!.id;
      const requestedStart = slot?.startTime || body.startTime!;
      const requestedEnd = slot?.endTime || body.endTime!;
      const dayStart = new Date(Date.UTC(event.eventDate.getUTCFullYear(), event.eventDate.getUTCMonth(), event.eventDate.getUTCDate()));
      const nextDay = new Date(dayStart);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const appointment = await db.$transaction(async (tx) => {
        const sameDayAppointments = await tx.healthAppointment.findMany({
          where: {
            patientId: patient.id,
            status: { not: HealthAppointmentStatus.CANCELLED },
            event: { eventDate: { gte: dayStart, lt: nextDay } },
          },
          select: { doctorId: true, startTime: true, endTime: true },
        });
        if (sameDayAppointments.some((existing) => existing.doctorId === requestedDoctorId)) {
          throw new Error("Only one appointment with the same doctor is allowed per day. Choose another doctor or date.");
        }
        if (sameDayAppointments.some((existing) =>
          overlaps(minutesFromTime(requestedStart), minutesFromTime(requestedEnd), existing.startTime, existing.endTime)
        )) {
          throw new Error("Appointment conflict: You already have another appointment during this time on the same day. Choose a different slot.");
        }
        if (slot) {
          const reserved = await tx.healthTimeSlot.updateMany({ where: { id: slot.id, booked: false }, data: { booked: true } });
          if (!reserved.count) throw new Error("That appointment time was just booked. Choose another time.");
        }
        return tx.healthAppointment.create({
          data: {
            patientId: patient.id,
            doctorId: requestedDoctorId,
            eventId: event.id,
            slotId: slot?.id || null,
            patientName: patient.name,
            patientPhone: patient.phone,
            startTime: requestedStart,
            endTime: requestedEnd,
            reason: body.reason || null,
            status: slot ? HealthAppointmentStatus.CONFIRMED : HealthAppointmentStatus.PENDING,
          },
          include: appointmentSelect,
        });
      }, { isolationLevel: "Serializable" });
      await db.auditLog.create({ data: { action: "PATIENT_APPOINTMENT_CREATED", actorId: patient.id, metadata: { appointmentId: appointment.id, eventId: event.id } } });
      res.status(201).json(appointment);
    } catch (error: any) {
      const conflict = error?.message?.includes("just booked")
        || error?.message?.includes("same doctor")
        || error?.message?.includes("Appointment conflict");
      res.status(conflict ? 409 : 400).json({ error: error?.message || "Could not make appointment" });
    }
  });
  return router;
}
