const ATTENDANCE_PATH = "/newsroom/appointments";

export const buildAttendanceQrUrl = (token: string, origin: string) =>
  `${origin.replace(/\/$/, "")}${ATTENDANCE_PATH}?attendance=${encodeURIComponent(token)}`;

export const attendanceTokenFromQr = (value: string, origin?: string) => {
  const text = value.trim();
  if (text.startsWith("local-news-attendance:"))
    return text.slice("local-news-attendance:".length).trim();
  try {
    const url = new URL(text, origin);
    if (url.pathname !== ATTENDANCE_PATH) return "";
    return url.searchParams.get("attendance")?.trim() || "";
  } catch {
    return "";
  }
};
