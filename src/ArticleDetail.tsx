import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Clock, Eye, MessageCircle, Play, Send, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import RichText from "./RichText";
import "./story-media.css";
import "./story-preview.css";
import "./story-lightbox.css";
import { firstHttpUrl, isVideoUrl, previewImageForUrl, richTextToPlainText } from "./richTextUtils";

type Photo = { id: string; url: string; caption: string | null; sortOrder: number };
type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  imageUrl?: string | null;
  photos: Photo[];
  views: number;
  publishedAt?: string;
  updatedAt?: string;
  status?: string;
  storyDate?: string | null;
  author: { name: string };
  category: { name: string };
};
type ResponseCategory = "UNDERSTANDING" | "TOLERANCE" | "GRATITUDE" | "CONTENTMENT";
type StoryComment = { id: string; body: string; createdAt: string; user: { id: string; name: string; avatarUrl?: string | null } };
type ResponseUser = { id: string; name: string };
type ResponseState = { responses: Record<ResponseCategory, number>; responders: Record<ResponseCategory, ResponseUser[]>; viewerResponse: ResponseCategory | null };

function StoryMedia({ media, title, thumbnail = false }: { media: Photo; title: string; thumbnail?: boolean }) {
  return isVideoUrl(media.url)
    ? <video src={media.url} controls={!thumbnail} muted={thumbnail} playsInline preload="metadata" aria-label={media.caption || title} />
    : <img src={media.url} alt={media.caption || title} />;
}
type MediaViewer = { kind: "youtube"; url: string } | { kind: "gallery"; items: Photo[]; index: number };

function youtubeEmbedUrl(value: string) {
  const thumbnail = previewImageForUrl(value);
  const videoId = thumbnail?.match(/\/vi\/([A-Za-z0-9_-]+)\//)?.[1];
  if (!videoId) return null;
  const origin = encodeURIComponent(window.location.origin);
  const pageUrl = encodeURIComponent(window.location.href);
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&origin=${origin}&widget_referrer=${pageUrl}`;
}
type Discussion = ResponseState & { photoResponses: Record<string, ResponseState>; comments: StoryComment[] };
type Session = { token: string; user: { id: string; name: string } };

const responseOptions: { value: ResponseCategory; english: string; chinese: string; shortChinese: string }[] = [
  { value: "UNDERSTANDING", english: "Understanding", chinese: "善解", shortChinese: "善" },
  { value: "TOLERANCE", english: "Tolerance", chinese: "包容", shortChinese: "容" },
  { value: "GRATITUDE", english: "Gratitude", chinese: "感恩", shortChinese: "恩" },
  { value: "CONTENTMENT", english: "Contentment", chinese: "知足", shortChinese: "足" },
];
const emptyResponders: Record<ResponseCategory, ResponseUser[]> = { UNDERSTANDING: [], TOLERANCE: [], GRATITUDE: [], CONTENTMENT: [] };
const emptyResponseState: ResponseState = { responses: { UNDERSTANDING: 0, TOLERANCE: 0, GRATITUDE: 0, CONTENTMENT: 0 }, responders: emptyResponders, viewerResponse: null };
const emptyDiscussion: Discussion = {
  ...emptyResponseState,
  photoResponses: {},
  comments: [],
};
const readSession = (): Session | null => { try { return JSON.parse(localStorage.getItem("ln_session") || "null"); } catch { return null; } };

function ReaderHeader() {
  return <PublicHeader><nav>{["Local", "Politics", "Business", "Sports", "Culture"].map((item) => <Link to="/" key={item}>{item}</Link>)}</nav></PublicHeader>;
}

function ResponseNames({ id, option, users }: { id: string; option: typeof responseOptions[number]; users: ResponseUser[] }) {
  return <span className="responseNames" id={id} role="tooltip"><strong>{option.english}</strong><small>{users.length ? users.map((user) => user.name).join(", ") : "No responses yet"}</small></span>;
}

function PhotoResponseControls({ photoId, state, disabled, openResponders, onToggle, onRespond }: { photoId: string; state?: ResponseState; disabled: boolean; openResponders: string; onToggle: (key: string) => void; onRespond: (photoId: string, category: ResponseCategory) => void }) {
  const current = state || emptyResponseState;
  return <div className="photoResponses" aria-label="Photo responses">{responseOptions.map((option) => { const key = `photo-${photoId}-${option.value}`, users = current.responders?.[option.value] || [], tooltipId = `${key}-responders`; return <button type="button" key={option.value} className={`${current.viewerResponse === option.value ? "selected " : ""}${openResponders === key ? "showResponders" : ""}`} aria-label={`${option.english} / ${option.shortChinese}: ${current.responses[option.value]} photo responses${users.length ? `. Responded by ${users.map((user) => user.name).join(", ")}` : ". No responders yet"}`} aria-describedby={tooltipId} aria-expanded={openResponders === key} aria-pressed={current.viewerResponse === option.value} disabled={disabled} onClick={() => { onToggle(key); onRespond(photoId, option.value); }}><span className="responseGlyph" aria-hidden="true">{option.shortChinese}</span><em aria-hidden="true">{current.responses[option.value]}</em><ResponseNames id={tooltipId} option={option} users={users} /></button>; })}</div>;
}

export default function ArticleDetail({ preview = false }: { preview?: boolean }) {
  const { slug, id } = useParams();
  const session = readSession();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [discussion, setDiscussion] = useState<Discussion>(emptyDiscussion);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [responseBusy, setResponseBusy] = useState(false);
  const [photoResponseBusy, setPhotoResponseBusy] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [notice, setNotice] = useState("");
  const [openResponders, setOpenResponders] = useState("");
  const [mediaViewer, setMediaViewer] = useState<MediaViewer | null>(null);
  const touchStartX = useRef<number | null>(null);

  const moveViewer = (direction: number) => setMediaViewer((current) => current?.kind === "gallery"
    ? { ...current, index: (current.index + direction + current.items.length) % current.items.length }
    : current);

  useEffect(() => {
    if (!mediaViewer) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMediaViewer(null);
      if (event.key === "ArrowLeft") moveViewer(-1);
      if (event.key === "ArrowRight") moveViewer(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mediaViewer?.kind]);

  const authHeaders = session ? { Authorization: `Bearer ${session.token}` } : {};
  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(preview ? `/api/newsroom/articles/${encodeURIComponent(id || "")}` : `/api/articles/${encodeURIComponent(slug || "")}`, { headers: preview ? authHeaders : {} })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Story not found"); return data; })
      .then(setArticle)
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [slug, id, preview]);

  useEffect(() => {
    if (!article || preview) return;
    setDiscussionLoading(true);
    fetch(`/api/articles/${article.id}/discussion`, { headers: authHeaders })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load discussion"); return data; })
      .then(setDiscussion)
      .catch((caught) => setNotice(caught.message))
      .finally(() => setDiscussionLoading(false));
  }, [article?.id, preview]);

  const saveResponse = async (category: ResponseCategory) => {
    if (!article || !session || responseBusy) return;
    setResponseBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/articles/${article.id}/responses`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ category }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save response");
      setDiscussion((current) => ({ ...current, responses: data.responses, responders: data.responders, viewerResponse: data.viewerResponse }));
      setNotice("Response saved");
    } catch (caught: any) { setNotice(caught.message); }
    finally { setResponseBusy(false); }
  };

  const postComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!article || !session || commentBusy || commentBody.trim().length < 2) return;
    setCommentBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/articles/${article.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ body: commentBody }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not post comment");
      setDiscussion((current) => ({ ...current, comments: [data, ...current.comments] }));
      setCommentBody("");
      setNotice("Comment posted");
    } catch (caught: any) { setNotice(caught.message); }
    finally { setCommentBusy(false); }
  };

  const savePhotoResponse = async (photoId: string, category: ResponseCategory) => {
    if (!article || !session || photoResponseBusy) return;
    setPhotoResponseBusy(photoId);
    setNotice("");
    try {
      const response = await fetch(`/api/articles/${article.id}/photos/${photoId}/responses`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ category }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save photo response");
      setDiscussion((current) => ({ ...current, photoResponses: { ...current.photoResponses, [photoId]: data } }));
      setNotice("Photo response saved");
    } catch (caught: any) { setNotice(caught.message); }
    finally { setPhotoResponseBusy(null); }
  };

  const backTo = preview ? "/newsroom/stories" : "/";
  if (loading) return <><ReaderHeader /><main className="articleState">Loading full story… / 正在載入完整新聞…</main></>;
  if (!article || error) return <><ReaderHeader /><main className="articleState"><h1>Story not found / 找不到新聞</h1><p>{error}</p><Link to={backTo}><ArrowLeft />{preview ? "Back to Story Management / 返回新聞管理" : "Back to local news / 返回本地新聞"}</Link></main></>;

  const contentUrl = firstHttpUrl(article.content);
  const contentPreview = contentUrl ? previewImageForUrl(contentUrl) : null;
  const fallbackPhoto = article.imageUrl || contentPreview;
  const photos = article.photos?.length ? article.photos : fallbackPhoto ? [{ id: "cover", url: fallbackPhoto, caption: null, sortOrder: 0 }] : [];
  const contentPreviewLink = !article.photos?.length && !article.imageUrl && contentPreview ? contentUrl : null;
  const youtubePreview = contentPreviewLink ? youtubeEmbedUrl(contentPreviewLink) : null;
  const readMinutes = Math.max(2, Math.ceil(richTextToPlainText(article.content).split(/\s+/).length / 220));
  const openMedia = (index: number) => {
    if (index === 0 && youtubePreview) setMediaViewer({ kind: "youtube", url: youtubePreview });
    else setMediaViewer({ kind: "gallery", items: photos, index });
  };

  return <div className="articlePage"><ReaderHeader /><main className="articleMain">
    {preview && <div className="storyPreviewBanner" role="status"><b>Story preview / 新聞預覽</b><span>{article.status || "DRAFT"} · This private preview is not visible to readers.</span></div>}
    <Link className="articleBack" to={backTo}><ArrowLeft />{preview ? "Back to Story Management / 返回新聞管理" : "Back to local news / 返回本地新聞"}</Link>
    <article>
      <header className="articleHeading">
        <span>{article.category.name}</span>
        <h1>{article.title}</h1>
        <RichText value={article.excerpt} className="articleSummaryRichText" />
        <div><b>By {article.author.name}</b><span><Clock />{readMinutes} min read</span>{!preview && <span><Eye />{article.views.toLocaleString()} views</span>}<time>{new Date(article.storyDate || article.publishedAt || article.updatedAt || Date.now()).toLocaleDateString()}</time></div>
      </header>
      {photos[0] && <figure className="articleLeadPhoto"><button type="button" className="articleMediaCard" onClick={() => openMedia(0)} aria-label={`${youtubePreview || isVideoUrl(photos[0].url) ? "Play video" : "View photo"}: ${photos[0].caption || article.title}`}><StoryMedia media={photos[0]} title={article.title} thumbnail /><span className="articleMediaCue">{youtubePreview || isVideoUrl(photos[0].url) ? <><Play />Play video / 播放影片</> : <><Eye />View photo / 查看照片</>}</span></button>{photos[0].caption && <figcaption>{photos[0].caption}</figcaption>}{!preview && photos[0].id !== "cover" && <PhotoResponseControls photoId={photos[0].id} state={discussion.photoResponses[photos[0].id]} disabled={discussionLoading || !!photoResponseBusy} openResponders={openResponders} onToggle={(key) => setOpenResponders((current) => current === key ? "" : key)} onRespond={savePhotoResponse} />}</figure>}
      <RichText value={article.content} className="articleBody" />
      {photos.length > 1 && <section className="articleGallery"><div><small>STORY GALLERY · 新聞相簿</small><h2>More from this story / 更多新聞照片與影片</h2></div><div>{photos.slice(1).map((photo, index) => <figure key={photo.id}><button type="button" className="articleMediaCard" onClick={() => openMedia(index + 1)} aria-label={`${isVideoUrl(photo.url) ? "Play video" : "View photo"}: ${photo.caption || article.title}`}><StoryMedia media={photo} title={article.title} thumbnail /><span className="articleMediaCue">{isVideoUrl(photo.url) ? <><Play />Play video / 播放影片</> : <><Eye />View photo / 查看照片</>}</span></button>{photo.caption && <figcaption>{photo.caption}</figcaption>}{!preview && <PhotoResponseControls photoId={photo.id} state={discussion.photoResponses[photo.id]} disabled={discussionLoading || !!photoResponseBusy} openResponders={openResponders} onToggle={(key) => setOpenResponders((current) => current === key ? "" : key)} onRespond={savePhotoResponse} />}</figure>)}</div></section>}
    </article>
    {!preview && <section className="storyDiscussion" aria-labelledby="story-discussion-title">
      <div className="discussionTitle"><small>READER VOICES</small><h2 id="story-discussion-title">Responses and comments</h2><p>Share how this story speaks to you and join the conversation.</p></div>
      <div className="responsePanel">
        <h3>Your response</h3>
        <div className="responseOptions">{responseOptions.map((option) => { const key = `story-${option.value}`, users = discussion.responders?.[option.value] || [], tooltipId = `${key}-responders`; return <button type="button" key={option.value} className={`${discussion.viewerResponse === option.value ? "selected " : ""}${openResponders === key ? "showResponders" : ""}`} aria-label={`${option.english} / ${option.chinese}: ${discussion.responses[option.value]} responses${users.length ? `. Responded by ${users.map((user) => user.name).join(", ")}` : ". No responders yet"}`} aria-describedby={tooltipId} aria-expanded={openResponders === key} aria-pressed={discussion.viewerResponse === option.value} disabled={responseBusy || discussionLoading} onClick={() => { setOpenResponders((current) => current === key ? "" : key); saveResponse(option.value); }}><span className="responseGlyph" aria-hidden="true">{option.chinese}</span><em aria-hidden="true">{discussion.responses[option.value]}</em><ResponseNames id={tooltipId} option={option} users={users} /></button>; })}</div>
        {session ? <p className="responseHint">Choose one response. You can change it at any time.</p> : <div className="discussionSignIn"><Link to="/login" state={{ from: `/stories/${slug}` }}>Sign in to respond or comment</Link></div>}
      </div>
      {session && <form className="commentForm" onSubmit={postComment}><label htmlFor="story-comment">Share a comment</label><textarea id="story-comment" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Write your comment…" maxLength={1000} rows={4} /><div><small>{commentBody.length} / 1000</small><button disabled={commentBusy || commentBody.trim().length < 2}>{commentBusy ? "Posting…" : <><Send />Post comment</>}</button></div></form>}
      {notice && <div className="discussionNotice" role="status">{notice}</div>}
      <div className="commentList"><div><h3><MessageCircle />Comments</h3><span>{discussion.comments.length}</span></div>{discussionLoading ? <p className="commentsEmpty">Loading comments…</p> : discussion.comments.length ? discussion.comments.map((comment) => <article key={comment.id}><div className="commentAvatar">{comment.user.avatarUrl ? <img src={comment.user.avatarUrl} alt="" /> : comment.user.name.slice(0, 2).toUpperCase()}</div><div><header><b>{comment.user.name}</b><time>{new Date(comment.createdAt).toLocaleString()}</time></header><p>{comment.body}</p></div></article>) : <p className="commentsEmpty">No comments yet. Start the conversation.</p>}</div>
    </section>}
  </main>{mediaViewer && <div className="storyLightbox" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMediaViewer(null)}><section role="dialog" aria-modal="true" aria-label="Story media viewer"><header><div><b>{article.title}</b>{mediaViewer.kind === "gallery" && <span>{mediaViewer.index + 1} / {mediaViewer.items.length}</span>}</div><button type="button" onClick={() => setMediaViewer(null)} aria-label="Close media viewer"><X /></button></header><div className="storyLightboxStage" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const endX = event.changedTouches[0]?.clientX; if (touchStartX.current !== null && endX !== undefined && Math.abs(endX - touchStartX.current) > 50) moveViewer(endX > touchStartX.current ? -1 : 1); touchStartX.current = null; }}>{mediaViewer.kind === "youtube" ? <iframe src={mediaViewer.url} title={article.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : isVideoUrl(mediaViewer.items[mediaViewer.index].url) ? <video key={mediaViewer.items[mediaViewer.index].url} src={mediaViewer.items[mediaViewer.index].url} controls autoPlay playsInline /> : <img src={mediaViewer.items[mediaViewer.index].url} alt={mediaViewer.items[mediaViewer.index].caption || article.title} />}{mediaViewer.kind === "gallery" && mediaViewer.items.length > 1 && <><button type="button" className="storyLightboxPrevious" onClick={() => moveViewer(-1)} aria-label="Previous photo or video"><ArrowLeft /></button><button type="button" className="storyLightboxNext" onClick={() => moveViewer(1)} aria-label="Next photo or video"><ArrowRight /></button></>}</div>{mediaViewer.kind === "gallery" && mediaViewer.items[mediaViewer.index].caption && <p>{mediaViewer.items[mediaViewer.index].caption}</p>}</section></div>}<footer><div className="brand light"><span>LN</span><div>LOCAL NEWS<small>INDEPENDENT. ESSENTIAL.</small></div></div><p>Reporting with context, accountability and care.</p><small>© 2026 Local News. All rights reserved.</small></footer></div>;
}
