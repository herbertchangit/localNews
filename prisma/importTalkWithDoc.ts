import { HealthAppointmentStatus, PrismaClient, Role } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

const db = new PrismaClient();
const sourceDirectory = path.resolve(process.argv[2] || "/tmp/talk-with-doc");

const readCollection = async (name: string) => {
  const value = JSON.parse(await fs.readFile(path.join(sourceDirectory, `${name}.json`), "utf8"));
  return Array.isArray(value) ? value : [];
};

const dateValue = (value: any, fallback = new Date()) => {
  const raw = value?.$date ?? value;
  const parsed = raw ? new Date(raw) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const imageValue = (value?: string | null) => {
  if (!value) return null;
  return value.startsWith("data:") ? value : `data:image/jpeg;base64,${value}`;
};

const mappedRole = (sourceRole: string, currentRole?: Role) => {
  if (currentRole === Role.ADMIN || currentRole === Role.EDITOR) return currentRole;
  if (sourceRole === "admin") return Role.ADMIN;
  if (sourceRole === "doctor") return Role.DOCTOR;
  return Role.DADE;
};

async function main() {
  const [users, profiles, events, assignments, slots, appointments] = await Promise.all([
    readCollection("users"),
    readCollection("doctor_profiles"),
    readCollection("events"),
    readCollection("event_doctors"),
    readCollection("time_slots"),
    readCollection("appointments"),
  ]);

  const userIds = new Map<string, string>();
  for (const source of users) {
    const email = String(source.email || "").trim().toLowerCase();
    if (!email || !source.id) continue;
    const existing = await db.user.findUnique({ where: { email } });
    const role = mappedRole(String(source.role || "patient").toLowerCase(), existing?.role);
    const user = existing
      ? await db.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name || source.full_name,
            phone: existing.phone || source.phone || null,
            avatarUrl: existing.avatarUrl || imageValue(source.profile_image),
            role,
            suspended: source.is_active === false ? true : existing.suspended,
          },
        })
      : await db.user.create({
          data: {
            id: source.id,
            email,
            password: source.password,
            name: source.full_name || email,
            phone: source.phone || null,
            avatarUrl: imageValue(source.profile_image),
            role,
            suspended: source.is_active === false,
            createdAt: dateValue(source.created_at),
          },
        });
    userIds.set(source.id, user.id);
  }

  const doctorIds = new Set<string>();
  for (const source of profiles) {
    const userId = userIds.get(source.user_id);
    if (!userId || !source.id) continue;
    const profile = await db.doctorProfile.upsert({
      where: { userId },
      update: {
        specialization: source.specialization || "General Medicine",
        qualification: source.qualification || "Not specified",
        experienceYears: Number(source.experience_years || 0),
        bio: source.bio || null,
        profileImage: imageValue(source.profile_image),
        consultationFee: Number(source.consultation_fee || 0),
        dutySlots: source.duty_slots || [],
      },
      create: {
        id: source.id,
        userId,
        specialization: source.specialization || "General Medicine",
        qualification: source.qualification || "Not specified",
        experienceYears: Number(source.experience_years || 0),
        bio: source.bio || null,
        profileImage: imageValue(source.profile_image),
        consultationFee: Number(source.consultation_fee || 0),
        dutySlots: source.duty_slots || [],
        createdAt: dateValue(source.created_at),
      },
    });
    doctorIds.add(profile.id);
  }

  const fallbackAdmin = await db.user.findFirst({ where: { role: Role.ADMIN }, orderBy: { createdAt: "asc" } });
  if (!fallbackAdmin) throw new Error("A Local News administrator is required before importing health events");

  const eventIds = new Set<string>();
  for (const source of events) {
    if (!source.id) continue;
    const creatorId = userIds.get(source.created_by) || fallbackAdmin.id;
    await db.healthEvent.upsert({
      where: { id: source.id },
      update: {
        name: source.name,
        description: source.description || "",
        location: source.location || "",
        address: source.address || "",
        mapsUrl: source.maps_url || null,
        wazeUrl: source.waze_url || null,
        eventDate: dateValue(source.event_date),
        startTime: source.start_time || "09:00",
        endTime: source.end_time || "17:00",
        bannerImage: imageValue(source.banner_image),
        maxCapacity: Number(source.max_capacity || 100),
        active: source.is_active !== false,
        creatorId,
      },
      create: {
        id: source.id,
        name: source.name,
        description: source.description || "",
        location: source.location || "",
        address: source.address || "",
        mapsUrl: source.maps_url || null,
        wazeUrl: source.waze_url || null,
        eventDate: dateValue(source.event_date),
        startTime: source.start_time || "09:00",
        endTime: source.end_time || "17:00",
        bannerImage: imageValue(source.banner_image),
        maxCapacity: Number(source.max_capacity || 100),
        active: source.is_active !== false,
        creatorId,
        createdAt: dateValue(source.created_at),
      },
    });
    eventIds.add(source.id);
  }

  for (const source of assignments) {
    if (!source.id || !eventIds.has(source.event_id) || !doctorIds.has(source.doctor_id)) continue;
    await db.healthEventDoctor.upsert({
      where: { eventId_doctorId: { eventId: source.event_id, doctorId: source.doctor_id } },
      update: { assignedAt: dateValue(source.assigned_at) },
      create: { id: source.id, eventId: source.event_id, doctorId: source.doctor_id, assignedAt: dateValue(source.assigned_at) },
    });
  }

  const slotIds = new Set<string>();
  const slotById = new Map<string, any>();
  for (const source of slots) {
    if (!source.id || !eventIds.has(source.event_id) || !doctorIds.has(source.doctor_id)) continue;
    await db.healthTimeSlot.upsert({
      where: { id: source.id },
      update: {
        startTime: source.start_time,
        endTime: source.end_time,
        slotDurationMinutes: Number(source.slot_duration_minutes || 15),
        booked: Boolean(source.is_booked),
      },
      create: {
        id: source.id,
        eventId: source.event_id,
        doctorId: source.doctor_id,
        startTime: source.start_time,
        endTime: source.end_time,
        slotDurationMinutes: Number(source.slot_duration_minutes || 15),
        booked: Boolean(source.is_booked),
        createdAt: dateValue(source.created_at),
      },
    });
    slotIds.add(source.id);
    slotById.set(source.id, source);
  }

  const allowedStatuses = new Set(Object.values(HealthAppointmentStatus));
  for (const source of appointments) {
    const patientId = userIds.get(source.patient_id);
    const slot = slotById.get(source.slot_id);
    if (!source.id || !patientId || !doctorIds.has(source.doctor_id) || !eventIds.has(source.event_id)) continue;
    const statusValue = String(source.status || "confirmed").toUpperCase() as HealthAppointmentStatus;
    const status = allowedStatuses.has(statusValue) ? statusValue : HealthAppointmentStatus.CONFIRMED;
    await db.healthAppointment.upsert({
      where: { id: source.id },
      update: {
        patientId,
        doctorId: source.doctor_id,
        eventId: source.event_id,
        slotId: slotIds.has(source.slot_id) ? source.slot_id : null,
        patientName: source.patient_name || "Patient",
        patientPhone: source.patient_phone || null,
        startTime: slot?.start_time || "09:00",
        endTime: slot?.end_time || "09:15",
        reason: source.reason || null,
        status,
        qrCode: source.qr_code || null,
      },
      create: {
        id: source.id,
        patientId,
        doctorId: source.doctor_id,
        eventId: source.event_id,
        slotId: slotIds.has(source.slot_id) ? source.slot_id : null,
        patientName: source.patient_name || "Patient",
        patientPhone: source.patient_phone || null,
        startTime: slot?.start_time || "09:00",
        endTime: slot?.end_time || "09:15",
        reason: source.reason || null,
        status,
        qrCode: source.qr_code || null,
        createdAt: dateValue(source.created_at),
        updatedAt: dateValue(source.updated_at),
      },
    });
  }

  console.log(JSON.stringify({
    users: userIds.size,
    doctors: doctorIds.size,
    events: eventIds.size,
    timeSlots: slotIds.size,
    appointments: appointments.length,
  }));
}

main().finally(() => db.$disconnect());
