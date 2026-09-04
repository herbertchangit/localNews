import { useEffect, useState } from "react";
import "./photo-tags.css";
export default function PhotoTags({ articleId, photoId }: { articleId: string; photoId: string }) {
  const [tags, setTags] = useState<{ userId: string; user: { name: string } }[]>([]);
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = `/api/newsroom/articles/${articleId}/photos/${photoId}/tags`;
  const headers = { Authorization: `Bearer ${JSON.parse(localStorage.getItem("ln_session") || "null")?.token}`, "Content-Type": "application/json" };
  async function load() { const r = await fetch(url, { headers }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setTags(data); }
  useEffect(() => { load().catch(e => setError(e.message)); }, [url]);
  useEffect(() => {
    const controller = new AbortController();
    setUsers([]); setSearchError(""); setSearching(Boolean(email.trim()));
    if (!email.trim()) return () => controller.abort();
    const timer = window.setTimeout(async () => {
      try {
        const r = await fetch(`${url.replace(/\/tags$/, "/tag-users")}?search=${encodeURIComponent(email.trim())}`, { headers, signal: controller.signal });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Unable to search users");
        if (!controller.signal.aborted) setUsers(data);
      } catch (e) { if (!controller.signal.aborted) setSearchError(e instanceof Error ? e.message : "Unable to search users"); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [email, url]);
  async function update(body: object) {
    setBusy(true); setError("");
    try { const r = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); await load(); setEmail(""); window.dispatchEvent(new Event("localnews:photo-tags-updated")); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save tag"); }
    finally { setBusy(false); }
  }
  return <section className="photoTagEditor"><label>Tag user / 標記用戶<input type="search" maxLength={100} placeholder="Full name or email / 姓名或電郵" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
    {email.trim() && <div className="photoTagSuggestions" aria-label="Matching users">
      {searching ? <p role="status">Searching… / 搜尋中…</p> : searchError ? <p role="alert">{searchError}</p> : users.length ? users.map(user => <button key={user.id} type="button" disabled={busy || tags.some(tag => tag.userId === user.id)} onClick={() => update({ userId: user.id })}><strong>{user.name}</strong><small>{user.email}</small>{tags.some(tag => tag.userId === user.id) && <small>Already tagged / 已標記</small>}</button>) : <p role="status">No users found / 找不到用戶</p>}
    </div>}
    <small>Select a user to save the tag immediately. / 選取用戶即時儲存標記。</small>
    {tags.map(tag => <div key={tag.userId}>{tag.user.name} <button type="button" disabled={busy} onClick={() => update({ removeUserId: tag.userId })}>Remove tag / 移除標記</button></div>)}
    {error && <p role="alert">{error}</p>}
  </section>;
}
