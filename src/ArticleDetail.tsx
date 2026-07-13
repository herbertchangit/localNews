import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Clock, Eye, Menu, MessageCircle, Search, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";

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
  author: { name: string };
  category: { name: string };
};
type ResponseCategory = "UNDERSTANDING" | "TOLERANCE" | "GRATITUDE" | "CONTENTMENT";
type StoryComment = { id: string; body: string; createdAt: string; user: { id: string; name: string; avatarUrl?: string | null } };
type Discussion = { responses: Record<ResponseCategory, number>; viewerResponse: ResponseCategory | null; comments: StoryComment[] };
type Session = { token: string; user: { id: string; name: string } };

const responseOptions: { value: ResponseCategory; english: string; chinese: string }[] = [
  { value: "UNDERSTANDING", english: "Understanding", chinese: "善解" },
  { value: "TOLERANCE", english: "Tolerance", chinese: "包容" },
  { value: "GRATITUDE", english: "Gratitude", chinese: "感恩" },
  { value: "CONTENTMENT", english: "Contentment", chinese: "知足" },
];
const emptyDiscussion: Discussion = {
  responses: { UNDERSTANDING: 0, TOLERANCE: 0, GRATITUDE: 0, CONTENTMENT: 0 },
  viewerResponse: null,
  comments: [],
};
const readSession = (): Session | null => { try { return JSON.parse(localStorage.getItem("ln_session") || "null"); } catch { return null; } };

function ReaderHeader() {
  return <><div className="ticker"><b>LOCAL NEWS</b><span>Independent reporting for our community</span></div><header>
    <Link to="/" className="brand"><span>LN</span><div>LOCAL NEWS<small>THE CITY, CLEARLY</small></div></Link>
    <nav>{["Local", "Politics", "Business", "Sports", "Culture"].map((item) => <Link to="/" key={item}>{item}</Link>)}</nav>
    <div className="actions"><button aria-label="Search"><Search /></button><Link className="studio" to="/newsroom">Newsroom</Link><button className="mobile"><Menu /></button></div>
  </header></>;
}

export default function ArticleDetail() {
  const { slug } = useParams();
  const session = readSession();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [discussion, setDiscussion] = useState<Discussion>(emptyDiscussion);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [responseBusy, setResponseBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [notice, setNotice] = useState("");

  const authHeaders = session ? { Authorization: `Bearer ${session.token}` } : {};
  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/articles/${encodeURIComponent(slug || "")}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Story not found"); return data; })
      .then(setArticle)
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!article) return;
    setDiscussionLoading(true);
    fetch(`/api/articles/${article.id}/discussion`, { headers: authHeaders })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load discussion"); return data; })
      .then(setDiscussion)
      .catch((caught) => setNotice(caught.message))
      .finally(() => setDiscussionLoading(false));
  }, [article?.id]);

  const saveResponse = async (category: ResponseCategory) => {
    if (!article || !session || responseBusy) return;
    setResponseBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/articles/${article.id}/responses`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ category }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save response");
      setDiscussion((current) => ({ ...current, responses: data.responses, viewerResponse: data.viewerResponse }));
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

  if (loading) return <><ReaderHeader /><main className="articleState">Loading full story… / 正在載入完整新聞…</main></>;
  if (!article || error) return <><ReaderHeader /><main className="articleState"><h1>Story not found / 找不到新聞</h1><p>{error}</p><Link to="/"><ArrowLeft />Back to local news / 返回本地新聞</Link></main></>;

  const photos = article.photos?.length ? article.photos : article.imageUrl ? [{ id: "cover", url: article.imageUrl, caption: null, sortOrder: 0 }] : [];
  const paragraphs = article.content.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const readMinutes = Math.max(2, Math.ceil(article.content.split(/\s+/).length / 220));

  return <div className="articlePage"><ReaderHeader /><main className="articleMain">
    <Link className="articleBack" to="/"><ArrowLeft />Back to local news / 返回本地新聞</Link>
    <article>
      <header className="articleHeading">
        <span>{article.category.name}</span>
        <h1>{article.title}</h1>
        <p>{article.excerpt}</p>
        <div><b>By {article.author.name}</b><span><Clock />{readMinutes} min read</span><span><Eye />{article.views.toLocaleString()} views</span><time>{new Date(article.publishedAt || Date.now()).toLocaleDateString()}</time></div>
      </header>
      {photos[0] && <figure className="articleLeadPhoto"><img src={photos[0].url} alt={photos[0].caption || article.title} />{photos[0].caption && <figcaption>{photos[0].caption}</figcaption>}</figure>}
      <div className="articleBody">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      {photos.length > 1 && <section className="articleGallery"><div><small>STORY GALLERY · 新聞相簿</small><h2>More from this story / 更多新聞照片</h2></div><div>{photos.slice(1).map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.caption || article.title} />{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>)}</div></section>}
    </article>
    <section className="storyDiscussion" aria-labelledby="story-discussion-title">
      <div className="discussionTitle"><small>READER VOICES</small><h2 id="story-discussion-title">Responses and comments</h2><p>Share how this story speaks to you and join the conversation.</p></div>
      <div className="responsePanel">
        <h3>Your response</h3>
        <div className="responseOptions">{responseOptions.map((option) => <button type="button" key={option.value} className={discussion.viewerResponse === option.value ? "selected" : ""} data-english={option.english} aria-label={`${option.english} / ${option.chinese}: ${discussion.responses[option.value]} responses`} aria-pressed={discussion.viewerResponse === option.value} disabled={responseBusy || discussionLoading || !session} onClick={() => saveResponse(option.value)}><span aria-hidden="true">{option.chinese}</span><em aria-hidden="true">{discussion.responses[option.value]}</em></button>)}</div>
        {session ? <p className="responseHint">Choose one response. You can change it at any time.</p> : <div className="discussionSignIn"><Link to="/login" state={{ from: `/stories/${slug}` }}>Sign in to respond or comment</Link></div>}
      </div>
      {session && <form className="commentForm" onSubmit={postComment}><label htmlFor="story-comment">Share a comment</label><textarea id="story-comment" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Write your comment…" maxLength={1000} rows={4} /><div><small>{commentBody.length} / 1000</small><button disabled={commentBusy || commentBody.trim().length < 2}>{commentBusy ? "Posting…" : <><Send />Post comment</>}</button></div></form>}
      {notice && <div className="discussionNotice" role="status">{notice}</div>}
      <div className="commentList"><div><h3><MessageCircle />Comments</h3><span>{discussion.comments.length}</span></div>{discussionLoading ? <p className="commentsEmpty">Loading comments…</p> : discussion.comments.length ? discussion.comments.map((comment) => <article key={comment.id}><div className="commentAvatar">{comment.user.avatarUrl ? <img src={comment.user.avatarUrl} alt="" /> : comment.user.name.slice(0, 2).toUpperCase()}</div><div><header><b>{comment.user.name}</b><time>{new Date(comment.createdAt).toLocaleString()}</time></header><p>{comment.body}</p></div></article>) : <p className="commentsEmpty">No comments yet. Start the conversation.</p>}</div>
    </section>
  </main><footer><div className="brand light"><span>LN</span><div>LOCAL NEWS<small>INDEPENDENT. ESSENTIAL.</small></div></div><p>Reporting with context, accountability and care.</p><small>© 2026 Local News. All rights reserved.</small></footer></div>;
}
