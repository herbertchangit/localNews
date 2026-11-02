export function sessionTokenExpired(token: string, now = Date.now()) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));
    return typeof decoded.exp !== "number" || decoded.exp * 1000 <= now;
  } catch {
    return true;
  }
}
