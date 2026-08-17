import { toCsv } from "./userCsv";

type RegistrationExportForm = {
  eventName: string;
  description: string;
  eventDates: { id: string; eventDate: string }[];
  customFields?: { id: string; title: string }[];
  submissions: {
    registrantName: string;
    identity: string;
    contact: string;
    origin: string;
    createdAt: string;
    unregisteredAt: string | null;
    customAnswers?: Record<string, string | number | boolean | string[]>;
    attendances: {
      totalPersons: number;
      meal: boolean;
      eventDate: { id: string; eventDate: string };
    }[];
  }[];
};

const dateOnly = (value: string) => value.slice(0, 10);

const answerText = (value: unknown) =>
  Array.isArray(value) ? value.join(", ") : String(value ?? "");

export const registrationCsvTable = (form: RegistrationExportForm) => {
  const customFields = Array.isArray(form.customFields)
    ? form.customFields
    : [];
  const eventDates = [...form.eventDates].sort((left, right) =>
    left.eventDate.localeCompare(right.eventDate),
  );
  const headers = [
    "Event name / 活动名称",
    "Description / 描述",
    "Registrant name / 登记者姓名",
    "Identity / 身份",
    "Contact / 联系方式",
    "From / 来自",
    ...customFields.map((field) => field.title),
    ...eventDates.flatMap((eventDate) => [
      `${dateOnly(eventDate.eventDate)} Persons / 人数`,
      `${dateOnly(eventDate.eventDate)} Meal / 用餐`,
    ]),
    "Status / 状态",
    "Registered at / 登记时间",
    "Un-registered at / 取消登记时间",
  ];
  const rows = form.submissions.map((submission) => [
    form.eventName,
    form.description,
    submission.registrantName,
    submission.identity === "VOLUNTEER"
      ? "Volunteer / 志工"
      : "Non-Volunteer / 非志工",
    submission.contact,
    submission.origin,
    ...customFields.map((field) =>
      answerText(submission.customAnswers?.[field.id]),
    ),
    ...eventDates.flatMap((eventDate) => {
      const attendance = submission.attendances.find(
        (item) => item.eventDate.id === eventDate.id,
      );
      return attendance
        ? [attendance.totalPersons, attendance.meal ? "Yes / 是" : "No / 否"]
        : ["", ""];
    }),
    submission.unregisteredAt
      ? "Un-registered / 已取消登记"
      : "Registered / 已登记",
    submission.createdAt,
    submission.unregisteredAt || "",
  ]);
  return { headers, rows };
};

export const registrationCsv = (form: RegistrationExportForm) => {
  const { headers, rows } = registrationCsvTable(form);
  return `\uFEFF${toCsv(headers, rows)}`;
};

export const registrationCsvFilename = (eventName: string) => {
  const safeName =
    eventName
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "registration";
  return `${safeName}-registrations.csv`;
};
