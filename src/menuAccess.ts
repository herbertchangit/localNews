import { useEffect, useMemo, useState } from "react";

type RoleAccessResponse = {
  configured: boolean;
  roles?: string[];
  menuIds: string[] | null;
  authorities: Record<string, string[]> | null;
};

export type MenuVisibility = ((id: string) => boolean) & { configured: boolean; loading: boolean };

const session = () => JSON.parse(localStorage.getItem("ln_session") || "null");
const ordinaryDefaults = new Set(["overview", "talk_with_doc", "appointments", "settings", "logout", "update_app"]);
const editorialDefaults = new Set(["overview", "stories", "talk_with_doc", "appointments", "settings", "logout", "update_app"]);
const medicalDefaults = new Set(["health_events", "appointments", "doctors", "logout", "update_app"]);

const defaultMenus = (role = "") => {
  if (role === "ADMIN") return null;
  if (role === "ADMIN_MEDICAL") return medicalDefaults;
  if (["EDITOR", "REPORTER", "VOLUNTEER"].includes(role)) return editorialDefaults;
  return ordinaryDefaults;
};

function useRoleAccess() {
  const current = session();
  const [data, setData] = useState<RoleAccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = current?.token;
    if (!token) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    fetch("/api/role-menus/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [current?.token, current?.user?.role, JSON.stringify(current?.user?.roles || [])]);
  return { data, loading, role: current?.user?.role || "", roles: data?.roles || current?.user?.roles || [] };
}

export function useMenuAccess(): MenuVisibility {
  const { data, loading, role, roles } = useRoleAccess();
  return useMemo(() => {
    const configured = Boolean(data?.configured);
    const selected = configured
      ? new Set(data?.menuIds || [])
      : [...new Set([...roles, role])].reduce<Set<string> | null>((combined, currentRole) => {
          const defaults = defaultMenus(currentRole);
          if (combined === null || defaults === null) return null;
          defaults.forEach((menu) => combined.add(menu));
          return combined;
        }, new Set<string>());
    return Object.assign((id: string) => selected === null || selected.has(id), { configured, loading });
  }, [data, loading, role, roles]);
}

export function useAuthorities(menuId: string) {
  const { data } = useRoleAccess();
  return useMemo(() => {
    const configured = Boolean(data?.configured && data.authorities && Object.keys(data.authorities).length);
    const selected = configured ? new Set(data?.authorities?.[menuId] || []) : null;
    return (action: string) => selected === null || selected.has(action);
  }, [data, menuId]);
}
