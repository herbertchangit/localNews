const MALAYSIA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export const malaysiaDateKey = (value = new Date()) =>
  new Date(value.getTime() + MALAYSIA_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);

export const attendanceDateError = (eventDate: Date, now = new Date()) => {
  const eventDateKey = eventDate.toISOString().slice(0, 10);
  const currentDateKey = malaysiaDateKey(now);
  if (eventDateKey === currentDateKey) return null;
  if (eventDateKey > currentDateKey)
    return `Attendance cannot be marked before the event date ${eventDateKey}. / 活动日期 ${eventDateKey} 之前不能签到。`;
  return `This attendance QR expired after the event date ${eventDateKey}. / 此签到二维码已于活动日期 ${eventDateKey} 后失效。`;
};
