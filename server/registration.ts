// @ts-nocheck
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PASSWORD } from "./passwordPolicy.js";
import { isContactMatch, loginEmailForContact } from "./loginIdentifier.js";
import { findRegistrationConflicts } from "./registrationDuplicate.js";

const MANAGE_PERMISSION = "registrations.manage";
const uploadDirectory = path.resolve("uploads");
const photoInput = z.object({ dataUrl: z.string().max(7_500_000) });
const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid event date");
const customFieldType = z.enum(["TEXT", "TEXTAREA", "NUMBER", "DATE", "SELECT", "RADIO", "CHECKBOX"]);
const customFieldInput = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  type: customFieldType,
  required: z.boolean().optional().default(false),
  options: z.array(z.string().trim().min(1).max(120)).max(50).optional().default([]),
}).transform((field) => ({ ...field, options: [...new Set(field.options)] }));
const formInput = z.object({
  eventName: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(5000),
  active: z.boolean().optional().default(true),
  eventDates: z.array(dateValue).min(1).max(60).transform((dates) => [...new Set(dates)]),
  viewerIds: z.array(z.string().min(1)).max(500).optional().default([]).transform((ids) => [...new Set(ids)]),
  customFields: z.array(customFieldInput).max(100).optional().default([])
    .refine((fields) => new Set(fields.map((field) => field.id)).size === fields.length, "Custom field IDs must be unique")
    .refine((fields) => fields.every((field) => !["SELECT", "RADIO", "CHECKBOX"].includes(field.type) || field.options.length > 0), "Choice fields require at least one option"),
});
const customAnswerValue = z.union([z.string().max(5000), z.number().finite(), z.boolean(), z.array(z.string().max(120)).max(50)]);
const submissionInput = z.object({
  registrantName: z.string().trim().min(2).max(120),
  identity: z.enum(["VOLUNTEER", "NON_VOLUNTEER"]),
  contact: z.string().trim().min(5).max(80),
  origin: z.string().trim().min(2).max(160),
  attendances: z.array(z.object({
    eventDateId: z.string().min(1),
    totalPersons: z.coerce.number().int().min(1).max(999),
    meal: z.boolean(),
  })).min(1).max(60).refine((items) => new Set(items.map((item) => item.eventDateId)).size === items.length, "Duplicate event dates are not allowed"),
  customAnswers: z.record(customAnswerValue).optional().default({}),
});
const submissionUpdateInput = z.object({
  attendances: z.array(z.object({
    id: z.string().min(1),
    totalPersons: z.coerce.number().int().min(1).max(999),
    meal: z.boolean(),
  })).min(1).max(60).refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Duplicate attendance records are not allowed"),
});
const attendanceUpdateInput = z.object({
  totalPersons: z.coerce.number().int().min(1).max(999),
  meal: z.boolean(),
});

const dateAtUtcMidnight = (value: string) => new Date(`${value}T00:00:00.000Z`);
const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const validateCustomAnswers = (fields: any[], answers: Record<string, unknown>) => {
  const allowed = new Set(fields.map((field) => field.id));
  if (Object.keys(answers).some((id) => !allowed.has(id))) return "One or more custom answers are invalid";
  for (const field of fields) {
    const value = answers[field.id];
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (field.required && empty) return `${field.title} is required`;
    if (empty) continue;
    if (field.type === "NUMBER" && typeof value !== "number") return `${field.title} must be a number`;
    if (["SELECT", "RADIO"].includes(field.type) && (typeof value !== "string" || !field.options.includes(value))) return `${field.title} has an invalid choice`;
    if (field.type === "CHECKBOX" && (!Array.isArray(value) || value.some((item) => !field.options.includes(item)))) return `${field.title} has an invalid choice`;
    if (!["NUMBER", "CHECKBOX"].includes(field.type) && typeof value !== "string") return `${field.title} has an invalid value`;
  }
  return null;
};
const baseSlug = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "registration";
const removeRegistrationPhoto = async (photoUrl?: string | null) => {
  if (!photoUrl?.startsWith("/uploads/registration-")) return;
  const file = path.resolve(uploadDirectory, path.basename(photoUrl));
  if (path.dirname(file) === uploadDirectory) await fs.unlink(file).catch(() => {});
};
const writeRegistrationPhoto = async (formId: string, dataUrl: string) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Only PNG, JPEG, or WebP photos are allowed");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("Photo must be 5 MB or smaller");
  await fs.mkdir(uploadDirectory, { recursive: true });
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const name = `registration-${formId}-${Date.now()}.${extension}`;
  await fs.writeFile(path.join(uploadDirectory, name), bytes);
  return `/uploads/${name}`;
};

export function createRegistrationRouter(db: any, secret: string) {
  const router = express.Router();
  const authenticate = async (req: any, res: any, next: any) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return res.status(401).json({ error: "Authentication required" });
      req.user = jwt.verify(token, secret);
      const account = await db.user.findUnique({ where: { id: req.user.id }, select: { role: true, roles: true, permissions: true, locked: true, suspended: true } });
      if (!account || account.locked || account.suspended) return res.status(401).json({ error: "Inactive account" });
      req.registrationAccount = account;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
  const canManage = (req: any) => Boolean(req.roleAuthorityConfigured) || [req.registrationAccount?.role, ...(req.registrationAccount?.roles || [])].includes(Role.ADMIN) || req.registrationAccount?.permissions?.includes(MANAGE_PERMISSION);
  const manage = (req: any, res: any, next: any) => canManage(req) ? next() : res.status(403).json({ error: "Registration management permission required" });
  const include = {
    creator: { select: { id: true, name: true } },
    viewers: { select: { id: true, name: true, email: true }, orderBy: { name: "asc" } },
    eventDates: { orderBy: { eventDate: "asc" } },
    _count: { select: { submissions: { where: { unregisteredAt: null } } } },
  };
  const availableSlug = async (name: string) => {
    const base = baseSlug(name);
    let slug = base, suffix = 2;
    while (await db.registrationForm.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${suffix++}`;
    return slug;
  };

  router.get("/capability", authenticate, async (req: any, res) => {
    const assignedCount = canManage(req) ? 0 : await db.registrationForm.count({ where: { viewers: { some: { id: req.user.id } } } });
    res.json({ canManage: canManage(req), canAccess: canManage(req) || assignedCount > 0, assignedCount });
  });
  router.get("/mine", authenticate, async (req: any, res) => {
    const account = await db.user.findUnique({ where: { id: req.user.id }, select: { phone: true } });
    if (!account?.phone) return res.json([]);
    const submissions = await db.registrationSubmission.findMany({
      where: { unregisteredAt: null },
      include: {
        form: { select: { id: true, eventName: true, description: true, photoUrl: true } },
        attendances: { include: { eventDate: true }, orderBy: { eventDate: { eventDate: "asc" } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(submissions
      .filter((submission: any) => isContactMatch(account.phone, submission.contact))
      .flatMap((submission: any) => submission.attendances.map((attendance: any) => ({
        id: attendance.id,
        submissionId: submission.id,
        eventName: submission.form.eventName,
        description: submission.form.description,
        photoUrl: submission.form.photoUrl,
        eventDate: attendance.eventDate.eventDate,
        totalPersons: attendance.totalPersons,
        meal: attendance.meal,
        origin: submission.origin,
        status: "REGISTERED",
        createdAt: submission.createdAt,
      }))));
  });
  router.patch("/mine/:attendanceId", authenticate, async (req: any, res) => {
    const data = attendanceUpdateInput.parse(req.body);
    const account = await db.user.findUnique({ where: { id: req.user.id }, select: { phone: true } });
    if (!account?.phone) return res.status(404).json({ error: "Registration appointment not found" });
    const attendance = await db.registrationAttendance.findUnique({
      where: { id: req.params.attendanceId },
      include: { submission: { select: { id: true, formId: true, contact: true, unregisteredAt: true } } },
    });
    if (!attendance || !isContactMatch(account.phone, attendance.submission.contact)) return res.status(404).json({ error: "Registration appointment not found" });
    if (attendance.submission.unregisteredAt) return res.status(409).json({ error: "This registration is already un-registered" });
    const updated = await db.registrationAttendance.update({ where: { id: attendance.id }, data, include: { eventDate: true } });
    await db.auditLog.create({ data: { action: "REGISTRATION_ATTENDANCE_UPDATED", actorId: req.user.id, metadata: { formId: attendance.submission.formId, submissionId: attendance.submission.id, attendanceId: attendance.id } } });
    res.json(updated);
  });
  router.delete("/mine/:attendanceId", authenticate, async (req: any, res) => {
    const account = await db.user.findUnique({ where: { id: req.user.id }, select: { phone: true } });
    if (!account?.phone) return res.status(404).json({ error: "Registration appointment not found" });
    const attendance = await db.registrationAttendance.findUnique({
      where: { id: req.params.attendanceId },
      include: { submission: { include: { attendances: { select: { id: true } } } } },
    });
    if (!attendance || !isContactMatch(account.phone, attendance.submission.contact)) return res.status(404).json({ error: "Registration appointment not found" });
    if (attendance.submission.unregisteredAt) return res.status(409).json({ error: "This registration is already un-registered" });
    if (attendance.submission.attendances.length === 1) {
      await db.registrationSubmission.update({ where: { id: attendance.submission.id }, data: { unregisteredAt: new Date() } });
    } else {
      await db.registrationAttendance.delete({ where: { id: attendance.id } });
    }
    await db.auditLog.create({ data: { action: "REGISTRATION_ATTENDANCE_UNREGISTERED", actorId: req.user.id, metadata: { formId: attendance.submission.formId, submissionId: attendance.submission.id, attendanceId: attendance.id } } });
    res.status(204).end();
  });
  router.get("/admin/viewer-options", authenticate, manage, async (_req, res) => {
    res.json(await db.user.findMany({ where: { locked: false, suspended: false }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: "asc" } }));
  });
  router.get("/admin/forms", authenticate, async (req: any, res) => {
    const where = canManage(req) ? {} : { viewers: { some: { id: req.user.id } } };
    res.json(await db.registrationForm.findMany({ where, include, orderBy: { updatedAt: "desc" } }));
  });
  router.post("/admin/forms", authenticate, manage, async (req: any, res) => {
    const data = formInput.parse(req.body);
    const form = await db.registrationForm.create({
      data: {
        eventName: data.eventName,
        description: data.description,
        active: data.active,
        customFields: data.customFields,
        slug: await availableSlug(data.eventName),
        creatorId: req.user.id,
        viewers: { connect: data.viewerIds.map((id) => ({ id })) },
        eventDates: { create: data.eventDates.map((eventDate) => ({ eventDate: dateAtUtcMidnight(eventDate) })) },
      },
      include,
    });
    await db.auditLog.create({ data: { action: "REGISTRATION_FORM_CREATED", actorId: req.user.id, metadata: { formId: form.id, eventName: form.eventName } } });
    res.status(201).json(form);
  });
  router.patch("/admin/forms/:id", authenticate, manage, async (req: any, res) => {
    const data = formInput.parse(req.body);
    const current = await db.registrationForm.findUnique({ where: { id: req.params.id }, include: { eventDates: { include: { _count: { select: { attendances: true } } } } } });
    if (!current) return res.status(404).json({ error: "Registration form not found" });
    const wanted = new Set(data.eventDates);
    const blocked = current.eventDates.find((item: any) => !wanted.has(isoDate(item.eventDate)) && item._count.attendances > 0);
    if (blocked) return res.status(409).json({ error: `The date ${isoDate(blocked.eventDate)} already has registrations and cannot be removed` });
    const existing = new Set(current.eventDates.map((item: any) => isoDate(item.eventDate)));
    await db.$transaction([
      db.registrationEventDate.deleteMany({ where: { formId: current.id, eventDate: { notIn: data.eventDates.map(dateAtUtcMidnight) } } }),
      db.registrationEventDate.createMany({ data: data.eventDates.filter((date) => !existing.has(date)).map((eventDate) => ({ formId: current.id, eventDate: dateAtUtcMidnight(eventDate) })) }),
      db.registrationForm.update({ where: { id: current.id }, data: { eventName: data.eventName, description: data.description, active: data.active, customFields: data.customFields, viewers: { set: data.viewerIds.map((id) => ({ id })) } } }),
    ]);
    const form = await db.registrationForm.findUnique({ where: { id: current.id }, include });
    await db.auditLog.create({ data: { action: "REGISTRATION_FORM_UPDATED", actorId: req.user.id, metadata: { formId: current.id } } });
    res.json(form);
  });
  router.post("/admin/forms/:id/photo", authenticate, manage, async (req: any, res) => {
    const { dataUrl } = photoInput.parse(req.body);
    const current = await db.registrationForm.findUnique({ where: { id: req.params.id }, select: { id: true, photoUrl: true } });
    if (!current) return res.status(404).json({ error: "Registration form not found" });
    const photoUrl = await writeRegistrationPhoto(current.id, dataUrl);
    try {
      const form = await db.registrationForm.update({ where: { id: current.id }, data: { photoUrl }, include });
      await removeRegistrationPhoto(current.photoUrl);
      await db.auditLog.create({ data: { action: "REGISTRATION_FORM_PHOTO_UPDATED", actorId: req.user.id, metadata: { formId: current.id } } });
      res.json(form);
    } catch (error) {
      await removeRegistrationPhoto(photoUrl);
      throw error;
    }
  });
  router.delete("/admin/forms/:id/photo", authenticate, manage, async (req: any, res) => {
    const current = await db.registrationForm.findUnique({ where: { id: req.params.id }, select: { id: true, photoUrl: true } });
    if (!current) return res.status(404).json({ error: "Registration form not found" });
    const form = await db.registrationForm.update({ where: { id: current.id }, data: { photoUrl: null }, include });
    await removeRegistrationPhoto(current.photoUrl);
    await db.auditLog.create({ data: { action: "REGISTRATION_FORM_PHOTO_REMOVED", actorId: req.user.id, metadata: { formId: current.id } } });
    res.json(form);
  });
  router.delete("/admin/forms/:id", authenticate, manage, async (req: any, res) => {
    const current = await db.registrationForm.findUnique({ where: { id: req.params.id }, select: { id: true, eventName: true, photoUrl: true } });
    if (!current) return res.status(404).json({ error: "Registration form not found" });
    await db.registrationForm.delete({ where: { id: current.id } });
    await removeRegistrationPhoto(current.photoUrl);
    await db.auditLog.create({ data: { action: "REGISTRATION_FORM_DELETED", actorId: req.user.id, metadata: { formId: current.id, eventName: current.eventName } } });
    res.status(204).end();
  });
  router.get("/admin/forms/:id/submissions", authenticate, async (req: any, res) => {
    const allowed = canManage(req) || Boolean(await db.registrationForm.findFirst({ where: { id: req.params.id, viewers: { some: { id: req.user.id } } }, select: { id: true } }));
    if (!allowed) return res.status(403).json({ error: "This registration form is not assigned to you" });
    const form = await db.registrationForm.findUnique({
      where: { id: req.params.id },
      include: {
        eventDates: { orderBy: { eventDate: "asc" } },
        submissions: { orderBy: { createdAt: "desc" }, include: { attendances: { include: { eventDate: true }, orderBy: { eventDate: { eventDate: "asc" } } } } },
      },
    });
    form ? res.json(form) : res.status(404).json({ error: "Registration form not found" });
  });
  router.patch("/admin/submissions/:id", authenticate, manage, async (req: any, res) => {
    const data = submissionUpdateInput.parse(req.body);
    const submission = await db.registrationSubmission.findUnique({ where: { id: req.params.id }, include: { attendances: { select: { id: true } } } });
    if (!submission) return res.status(404).json({ error: "Registration not found" });
    if (submission.unregisteredAt) return res.status(409).json({ error: "Un-registered entries cannot be changed" });
    const allowed = new Set(submission.attendances.map((item: any) => item.id));
    if (data.attendances.some((item) => !allowed.has(item.id))) return res.status(400).json({ error: "One or more attendance records are invalid" });
    await db.$transaction(data.attendances.map((item) => db.registrationAttendance.update({ where: { id: item.id }, data: { totalPersons: item.totalPersons, meal: item.meal } })));
    await db.auditLog.create({ data: { action: "REGISTRATION_UPDATED", actorId: req.user.id, metadata: { formId: submission.formId, submissionId: submission.id } } });
    res.json(await db.registrationSubmission.findUnique({ where: { id: submission.id }, include: { attendances: { include: { eventDate: true }, orderBy: { eventDate: { eventDate: "asc" } } } } }));
  });
  router.delete("/admin/submissions/:id", authenticate, manage, async (req: any, res) => {
    const submission = await db.registrationSubmission.findUnique({ where: { id: req.params.id }, select: { id: true, formId: true, registrantName: true, unregisteredAt: true } });
    if (!submission) return res.status(404).json({ error: "Registration not found" });
    if (submission.unregisteredAt) return res.status(409).json({ error: "Registrant is already un-registered" });
    const updated = await db.registrationSubmission.update({ where: { id: submission.id }, data: { unregisteredAt: new Date() }, include: { attendances: { include: { eventDate: true }, orderBy: { eventDate: { eventDate: "asc" } } } } });
    await db.auditLog.create({ data: { action: "REGISTRATION_UNREGISTERED", actorId: req.user.id, metadata: { formId: submission.formId, submissionId: submission.id, registrantName: submission.registrantName } } });
    res.json(updated);
  });
  router.get("/public/:slug/invitations/:token", async (req, res) => {
    const invitation = await db.registrationInvitation.findFirst({
      where: {
        token: req.params.token,
        form: { slug: req.params.slug, active: true },
      },
      select: {
        user: {
          select: {
            name: true,
            phone: true,
            stayArea: true,
            role: true,
            roles: true,
          },
        },
      },
    });
    if (!invitation) return res.status(404).json({ error: "This invitation link is invalid or unavailable" });
    const isVolunteer = invitation.user.role === Role.VOLUNTEER || invitation.user.roles.includes(Role.VOLUNTEER);
    res.json({
      registrantName: invitation.user.name,
      identity: isVolunteer ? "VOLUNTEER" : "NON_VOLUNTEER",
      contact: invitation.user.phone || "",
      area: invitation.user.stayArea || "",
    });
  });
  router.get("/public/:slug", async (req, res) => {
    const form = await db.registrationForm.findFirst({ where: { slug: req.params.slug, active: true }, select: { id: true, eventName: true, description: true, photoUrl: true, slug: true, customFields: true, eventDates: { select: { id: true, eventDate: true }, orderBy: { eventDate: "asc" } } } });
    form ? res.json(form) : res.status(404).json({ error: "This registration form is unavailable" });
  });
  router.post("/public/:slug/submissions", async (req, res) => {
    const data = submissionInput.parse(req.body);
    const form = await db.registrationForm.findFirst({ where: { slug: req.params.slug, active: true }, include: { eventDates: { select: { id: true, eventDate: true } } } });
    if (!form) return res.status(404).json({ error: "This registration form is unavailable" });
    const customAnswerError = validateCustomAnswers(Array.isArray(form.customFields) ? form.customFields : [], data.customAnswers);
    if (customAnswerError) return res.status(400).json({ error: customAnswerError });
    const allowed = new Set(form.eventDates.map((item: any) => item.id));
    if (data.attendances.some((item) => !allowed.has(item.eventDateId))) return res.status(400).json({ error: "One or more selected dates are invalid" });
    const generatedEmail = loginEmailForContact(data.contact);
    if (!generatedEmail) return res.status(400).json({ error: "Enter a valid contact number with at least 7 digits" });
    const existingRegistrations = await db.registrationSubmission.findMany({
      where: { formId: form.id, unregisteredAt: null },
      select: {
        registrantName: true,
        contact: true,
        attendances: { select: { eventDateId: true, eventDate: { select: { eventDate: true } } } },
      },
    });
    const conflicts = findRegistrationConflicts(existingRegistrations, data.contact, data.attendances.map((item) => item.eventDateId));
    if (conflicts.length) {
      const existingName = conflicts[0].registrantName;
      const dates = [...new Set(conflicts.flatMap((conflict) => conflict.dates.map(isoDate)))].sort();
      return res.status(409).json({
        code: "ALREADY_REGISTERED",
        existingRegistrantName: existingName,
        eventDates: dates,
        error: `This contact is already registered under ${existingName} for ${dates.join(", ")}. Each contact can register only once for each event date. / 此联络号码已由 ${existingName} 登记：${dates.join("、")}。每个活动日期只能登记一次。`,
      });
    }
    const contactUsers = await db.user.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true, name: true } });
    const matches = contactUsers.filter((user: any) => isContactMatch(data.contact, user.phone));
    if (matches.length > 1) return res.status(409).json({ error: "This contact number belongs to multiple accounts. Please contact an administrator." });
    let account = matches[0] || await db.user.findUnique({ where: { email: generatedEmail }, select: { id: true, phone: true, name: true } });
    let accountCreated = false;
    if (!account) {
      account = await db.user.create({
        data: {
          name: data.registrantName,
          email: generatedEmail,
          phone: data.contact,
          stayArea: data.origin,
          password: await bcrypt.hash(DEFAULT_PASSWORD, 12),
          role: Role.DADE,
        },
        select: { id: true, phone: true, name: true },
      });
      accountCreated = true;
    } else if (!account.phone) {
      account = await db.user.update({ where: { id: account.id }, data: { phone: data.contact }, select: { id: true, phone: true, name: true } });
    }
    const submission = await db.registrationSubmission.create({ data: { formId: form.id, registrantName: data.registrantName, identity: data.identity, contact: data.contact, origin: data.origin, customAnswers: data.customAnswers, attendances: { create: data.attendances } }, select: { id: true, createdAt: true } });
    await db.auditLog.create({ data: { action: "REGISTRATION_SUBMITTED", actorId: account.id, metadata: { formId: form.id, submissionId: submission.id, accountCreated } } });
    res.status(201).json({
      id: submission.id,
      submittedAt: submission.createdAt,
      accountCreated,
      accountName: account.name,
      passwordChangeToken: accountCreated ? jwt.sign({ id: account.id, scope: "password-change" }, secret, { expiresIn: "15m" }) : undefined,
    });
  });
  return router;
}
