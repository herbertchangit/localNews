export type RegistrationQuantityAnswer = Record<string, number>;

export const isRegistrationQuantityAnswer = (
  value: unknown,
): value is RegistrationQuantityAnswer =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.values(value as Record<string, unknown>).every(
    (quantity) => typeof quantity === "number",
  );

export const registrationAnswerText = (value: unknown) => {
  if (Array.isArray(value)) return value.join(", ");
  if (isRegistrationQuantityAnswer(value))
    return Object.entries(value)
      .map(([option, quantity]) => `${option} × ${quantity}`)
      .join(", ");
  return String(value ?? "");
};
