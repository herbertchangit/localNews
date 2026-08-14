export const normalizeRegisteredName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export const registeredNameMatches = (provided: string, registered: string) =>
  normalizeRegisteredName(provided) === normalizeRegisteredName(registered);
