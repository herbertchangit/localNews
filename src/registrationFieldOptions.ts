export const splitRegistrationOptionLines = (value: string) =>
  value.split(/\r?\n/);

export const cleanRegistrationOptionLines = (options: string[]) =>
  [...new Set(options.map((option) => option.trim()).filter(Boolean))];
