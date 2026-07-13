import { useEffect } from "react";

export const ROLE_CHOICES = [
  ["ADMIN", "Admin"],
  ["EDITOR", "Editor"],
  ["VOLUNTEER", "Volunteer"],
  ["DADE", "DaDe"],
];
const knownRoles = new Set(["ADMIN", "EDITOR", "REPORTER", "AUDIENCE", "VOLUNTEER", "DADE"]);
export const normalizeLegacyRole = (role: string) =>
  role === "REPORTER" ? "VOLUNTEER" : role === "AUDIENCE" ? "DADE" : role;

const normalize = () => {
  for (const select of document.querySelectorAll<HTMLSelectElement>("label select")) {
    if (![...select.options].some((option) => knownRoles.has(option.value))) continue;
    if (!select.dataset.roleListener) {
      select.addEventListener("change", () => {
        select.dataset.roleChoice = select.value;
      });
      select.dataset.roleListener = "true";
    }
    const current = select.dataset.roleChoice || select.value;
    const mapped = normalizeLegacyRole(current);
    if ([...select.options].map((option) => option.value).join(",") !== ROLE_CHOICES.map((choice) => choice[0]).join(",")) {
      select.replaceChildren(...ROLE_CHOICES.map(([value, text]) => new Option(text, value)));
      select.value = mapped;
      select.dataset.roleChoice = mapped;
    }
  }
};

export default function RoleOptions() {
  useEffect(() => {
    normalize();
    const observer = new MutationObserver(normalize);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
