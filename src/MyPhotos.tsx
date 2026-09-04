import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AudienceSidebar } from "./Audience";
type Photo = { id: string; url: string; caption: string | null; article: { title: string; slug: string; status: string } };
export default function MyPhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [status, setStatus] = useState("Loading… / 載入中…");
  useEffect(() => {
    const session = JSON.parse(localStorage.getItem("ln_session") || "null");
    let active = true;
    fetch("/api/me/photos", { headers: { Authorization: `Bearer ${session?.token}` } })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load photos"); return data; })
      .then(data => { if (active) { setPhotos(data); setStatus(data.length ? "" : "No tagged photos yet. / 暫無標記照片。"); } })
      .catch(error => { if (active) setStatus(error.message); });
    return () => { active = false; };
  }, []);
  return <div className="dash audienceDash"><AudienceSidebar active="photos" /><section className="content">
    <h1>Photos / 照片</h1><p>Photos tagged with your account remain available even after a story is unpublished. Private-story access restrictions still apply. / 標記您的照片在新聞取消發布後仍可查看，私人新聞的存取限制仍然適用。</p>
    <p role="status">{status}</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
      {photos.map(photo => <figure key={photo.id} style={{ margin: 0 }}><a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.caption || "Tagged story photo"} loading="lazy" style={{ width: "100%", height: 240, objectFit: "contain" }} /></a><figcaption>{photo.caption}<br />{photo.article.status === "PUBLISHED" ? <Link to={`/stories/${photo.article.slug}`}>{photo.article.title}</Link> : <span>{photo.article.title} · Unpublished / 未發布</span>}</figcaption></figure>)}
    </div>
  </section></div>;
}
