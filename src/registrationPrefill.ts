export type RegistrationSessionUser = {
  name?: string | null;
  role?: string | null;
};

export function registrationIdentityForRole(role?: string | null) {
  return role === "VOLUNTEER" ? "VOLUNTEER" : "NON_VOLUNTEER";
}

export function registrationPrefill(user?: RegistrationSessionUser | null, contact?: string | null, stayArea?: string | null) {
  return {
    registrantName: user?.name?.trim() || "",
    identity: registrationIdentityForRole(user?.role),
    contact: contact?.trim() || "",
    area: stayArea?.trim() || "",
  };
}
