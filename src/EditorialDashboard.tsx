import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Settings,
  Users,
  XCircle,
} from "lucide-react";

type EditorialArticle = {
  id: string;
  title: string;
  status: "DRAFT" | "REVIEW" | "REVISION";
  imageUrl: string | null;
  updatedAt: string;
  author: { name: string };
  category: { name: string };
};

type Session = {
  token: string;
  user: { name: string; role: "ADMIN" | "EDITOR" };
};

const session = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem("ln_session") || "null");
  } catch {
    return null;
  }
};

export default function EditorialDashboard() {
  const nav = useNavigate();
  const current = session();
  const [articles, setArticles] = useState<EditorialArticle[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [notice, setNotice] = useState("");
  const isAdmin = current?.user.role === "ADMIN";

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${current?.token || ""}`,
    }),
    [current?.token],
  );

  const load = async () => {
    if (!current) return;
    setLoading(true);
    try {
      const [queueResponse, optionResponse] = await Promise.all([
        fetch("/api/editor/articles", { headers }),
        fetch("/api/story-options", { headers }),
      ]);
      const queue = await queueResponse.json();
      const options = await optionResponse.json();
      if (!queueResponse.ok) throw new Error(queue.error || "Could not load editorial queue");
      if (!optionResponse.ok) throw new Error(options.error || "Could not load story options");
      setArticles(queue);
      setCanCreate(Boolean(options.canCreate));
    } catch (error: any) {
      setNotice(error.message || "Could not load editorial queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const verify = async (article: EditorialArticle, status: "PUBLISHED" | "REVISION") => {
    setWorkingId(article.id);
    try {
      const response = await fetch(`/api/articles/${article.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update story");
      if (status === "PUBLISHED") {
        setArticles((items) => items.filter((item) => item.id !== article.id));
        setNotice("Story verified and published / 新聞已審核並發布");
      } else {
        setArticles((items) =>
          items.map((item) => (item.id === article.id ? { ...item, status: "REVISION" } : item)),
        );
        setNotice("Revision requested / 已要求修改");
      }
    } catch (error: any) {
      setNotice(error.message || "Could not update story");
    } finally {
      setWorkingId("");
    }
  };

  const reviewCount = articles.filter((article) => article.status !== "REVISION").length;
  const revisionCount = articles.filter((article) => article.status === "REVISION").length;
  const initials = current?.user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="dash">
      <aside>
        <Link to="/" className="brand light">
          <span>LN</span>
          <div>LOCAL NEWS<small>NEWSROOM OS</small></div>
        </Link>
        <div className="workspace"><small>WORKSPACE</small><b>Central News Desk</b></div>
        <button className="active"><LayoutDashboard />Overview</button>
        <button onClick={() => nav("/newsroom/stories")}><FileText />Stories<em>{articles.length}</em></button>
        {isAdmin && <button><Users />People</button>}
        {isAdmin && <button><BarChart3 />Analytics</button>}
        <button onClick={() => !isAdmin && nav("/newsroom/settings")}><Settings />Settings</button>
        <div className="profile">
          <div>{initials}</div>
          <span><b>{current?.user.name}</b><small>{isAdmin ? "Administrator" : "Editor"}</small></span>
        </div>
      </aside>
      <section className="content editorialDashboard">
        <div className="top">
          <div>
            <small>EDITORIAL / VERIFICATION · 編輯 / 審核</small>
            <h1>News verification / 新聞審核</h1>
            <p>Review and verify stories before publication. / 發布前審閱及核實新聞。</p>
          </div>
          <div>
            <button className="icon" aria-label="Notifications"><Bell /></button>
            {canCreate && <button className="new"><Plus />New story</button>}
          </div>
        </div>
        {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        <div className="stats editorialStats">
          <div className="stat"><div><small>Editorial queue / 待審核</small><strong>{articles.length}</strong><span>Requires verification</span></div><FileCheck2 /></div>
          <div className="stat"><div><small>Ready for review / 可供審閱</small><strong>{reviewCount}</strong><span>Draft or in review</span></div><CheckCircle2 /></div>
          <div className="stat"><div><small>Revisions / 修改中</small><strong>{revisionCount}</strong><span>Returned to author</span></div><RefreshCw /></div>
          <div className="stat"><div><small>Verification role / 審核角色</small><strong>{isAdmin ? "Admin" : "Editor"}</strong><span>Publishing access</span></div><Users /></div>
        </div>
        <div className="panel">
          <div className="panelHead">
            <div><h2>Editorial queue / 編輯審核隊列</h2><p>Admin and Editor can verify and publish</p></div>
            <button onClick={load}>Refresh / 重新整理</button>
          </div>
          <div className="table">
            {loading && <div className="editorialEmpty">Loading editorial queue… / 正在載入審核隊列…</div>}
            {!loading && !articles.length && <div className="editorialEmpty">No stories waiting for verification. / 暫無待審核新聞。</div>}
            {!loading && articles.map((article) => (
              <div className="row" key={article.id}>
                <div className="story"><div className={`mini ${article.imageUrl ? "hasImage" : ""}`} style={article.imageUrl ? { backgroundImage: `url(${article.imageUrl})` } : undefined} /><span><b>{article.title}</b><small>{article.author.name} · {article.category.name}</small></span></div>
                <span className={`status ${article.status.toLowerCase()}`}>{article.status.replace("_", " ")}</span>
                <span className="time">{new Date(article.updatedAt).toLocaleDateString()}</span>
                <div className="rowActions">
                  <button disabled={workingId === article.id} title="Verify and publish / 審核並發布" onClick={() => verify(article, "PUBLISHED")}><CheckCircle2 /></button>
                  <button disabled={workingId === article.id || article.status === "REVISION"} title="Request revision / 要求修改" onClick={() => verify(article, "REVISION")}><XCircle /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
