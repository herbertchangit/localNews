import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Eye, Menu, Search } from "lucide-react";
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

function ReaderHeader() {
  return <><div className="ticker"><b>LOCAL NEWS</b><span>Independent reporting for our community</span></div><header>
    <Link to="/" className="brand"><span>LN</span><div>LOCAL NEWS<small>THE CITY, CLEARLY</small></div></Link>
    <nav>{["Local", "Politics", "Business", "Sports", "Culture"].map((item) => <Link to="/" key={item}>{item}</Link>)}</nav>
    <div className="actions"><button aria-label="Search"><Search /></button><Link className="studio" to="/newsroom">Newsroom</Link><button className="mobile"><Menu /></button></div>
  </header></>;
}

export default function ArticleDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/articles/${encodeURIComponent(slug || "")}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Story not found"); return data; })
      .then(setArticle)
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [slug]);

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
  </main><footer><div className="brand light"><span>LN</span><div>LOCAL NEWS<small>INDEPENDENT. ESSENTIAL.</small></div></div><p>Reporting with context, accountability and care.</p><small>© 2026 Local News. All rights reserved.</small></footer></div>;
}
