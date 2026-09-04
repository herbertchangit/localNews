import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Route,
  Routes,
  Link,
  useNavigate,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  Bell,
  Search,
  Menu,
  Clock,
  ArrowUpRight,
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  BarChart3,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Trash2,
  Mail,
  Eye,
  EyeOff,
  LogOut,
  Network,
  Tag,
  Quote,
  Languages,
  CalendarHeart,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  Stethoscope,
  RefreshCw,
  ShieldCheck,
  MapPinned,
} from "lucide-react";
import AccountManagement from "./AccountManagement";
import DepartmentManagement from "./DepartmentManagement";
import OrgStructureNormalized from "./OrgStructureNormalized";
import NewsCategoryManagement from "./NewsCategoryManagement";
import JingSiManagement from "./JingSiManagement";
import LanguageMappingManagement from "./LanguageMappingManagement";
import AreaManagement from "./AreaManagement";
import ReaderSettings from "./ReaderSettings";
import MyPhotos from "./MyPhotos";
import { useTaggedPhotos } from "./useTaggedPhotos";
import { SelfAvatarTools, AdminAvatarTools } from "./AvatarTools";
import StoryComposer from "./StoryComposer";
import StoryManagement from "./StoryManagement";
import ArticleDetail from "./ArticleDetail";
import PublicHeader from "./PublicHeader";
import NewsletterSignup from "./NewsletterSignup";
import RichText from "./RichText";
import {
  AudienceAppointments,
  AudienceDashboard,
  AudienceHealthServices,
} from "./Audience";
import {
  HealthAppointmentsAdmin,
  HealthDoctorsAdmin,
  HealthEventsAdmin,
} from "./HealthcareAdmin";
import {
  APP_UPDATE_RESULT_EVENT,
  CHECK_APP_UPDATE_EVENT,
  type AppUpdateResult,
} from "./pwaEvents";
import DoctorSettings from "./DoctorSettings";
import DoctorAppointments from "./DoctorAppointments";
import { AudienceHomepageDashboard } from "./Audience";
import { PasskeyLoginButton, PasskeySettingsTools } from "./PasskeyTools";
import CooperationPeople from "./CooperationPeople";
import RegistrationManagement from "./RegistrationManagement";
import PublicRegistration from "./PublicRegistration";
import SignUpForm from "./SignUpForm";
import { useActiveAppointmentCount } from "./useActiveAppointmentCount";
import RoleManagement from "./RoleManagement";
import { useMenuAccess } from "./menuAccess";
import { LanguageDropdown } from "./I18n";
import "./homepage-categories.css";
import { firstHttpUrl, firstPhotoUrl, previewImageForUrl } from "./richTextUtils";
import ShareStoryButton from "./ShareStoryButton";
type NewsCategory = { id: string; name: string; slug: string };
type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  imageUrl?: string | null;
  photos?: { id: string; url: string; caption?: string | null }[];
  category: { id?: string; name: string; slug?: string };
  author: { name: string };
  status: string;
  isBreaking: boolean;
  isTrending: boolean;
  isHeadline?: boolean;
  storyDate?: string | null;
  publishedAt?: string;
  views: number;
};
const homeScrollPositionKey = "ln_home_scroll_position";
const rememberHomeScrollPosition = () => {
  sessionStorage.setItem(homeScrollPositionKey, String(window.scrollY));
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
};
const fallback: Article[] = [
  {
    id: "1",
    title: "City council approves riverside renewal plan",
    slug: "riverside-renewal",
    excerpt:
      "The long-awaited project will add green space, safer walkways and a new community market.",
    content:
      "After months of public consultation, the city council approved the riverside renewal plan on Friday evening.",
    category: { name: "Local" },
    author: { name: "Aisha Rahman" },
    status: "PUBLISHED",
    isBreaking: true,
    isTrending: true,
    publishedAt: new Date().toISOString(),
    views: 12480,
  },
  {
    id: "2",
    title: "Small businesses lead downtown weekend revival",
    slug: "downtown-revival",
    excerpt:
      "Independent shops and cafés report their strongest quarter in three years.",
    content:
      "Local entrepreneurs are breathing new life into the downtown district.",
    category: { name: "Business" },
    author: { name: "Daniel Lee" },
    status: "PUBLISHED",
    isBreaking: false,
    isTrending: true,
    publishedAt: new Date().toISOString(),
    views: 8340,
  },
  {
    id: "3",
    title: "Tigers secure dramatic cup semi-final victory",
    slug: "tigers-cup",
    excerpt: "A stoppage-time winner sent the home crowd into celebration.",
    content: "The Tigers booked their place in the final.",
    category: { name: "Sports" },
    author: { name: "Maya Chen" },
    status: "PUBLISHED",
    isBreaking: false,
    isTrending: false,
    publishedAt: new Date().toISOString(),
    views: 6210,
  },
];
function Header({
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  categories: NewsCategory[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
}) {
  return (
    <PublicHeader className="homeHeader">
      <nav className="categoryNav" aria-label="News categories">
        <button
          className={!selectedCategory ? "active" : ""}
          aria-pressed={!selectedCategory}
          onClick={() => onSelectCategory(null)}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            className={selectedCategory === category.id ? "active" : ""}
            aria-pressed={selectedCategory === category.id}
            onClick={() => onSelectCategory(category.id)}
            key={category.id}
          >
            {category.name}
          </button>
        ))}
      </nav>
    </PublicHeader>
  );
}
function DailyBrief({ articles }: { articles: Article[] }) {
  return (
    <section className="latest dailyBrief">
      <div className="sectionTitle">
        <div>
          <span>THE DAILY BRIEF</span>
          <h2>What your city is talking about</h2>
        </div>
        <div className="dailyBriefActions">
          <small>
            {articles.length} published stories / {articles.length} 篇已發布新聞
          </small>
        </div>
      </div>
      <div className="dailyBriefTrack">
        {articles.map((x, i) => {
          const contentUrl = firstHttpUrl(x.content),
            contentPreview = contentUrl ? previewImageForUrl(contentUrl) : null,
            photo =
              firstPhotoUrl(x.photos) ||
              x.imageUrl ||
              contentPreview,
            dateValue = x.storyDate || x.publishedAt,
            storyDateLabel = dateValue
              ? new Date(dateValue).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "Date not set";
          return (
            <article key={x.id}>
              <Link
                className="dailyBriefThumbLink"
                to={`/stories/${x.slug}`}
                aria-label={`Read ${x.title}`}
                onClick={rememberHomeScrollPosition}
              >
                <div
                  className={"thumb t" + (i % 3) + (photo ? " hasImage" : "")}
                  style={photo ? { backgroundImage: `url(${photo})` } : undefined}
                >
                  <span>{x.category.name}</span>
                </div>
              </Link>
              <div className="dailyBriefStoryBody">
                <div className="dailyBriefStoryMeta">
                  <span>STORY DATE · {storyDateLabel}</span>
                  <div className="meta">
                    {x.category.name} ·{" "}
                    {Math.max(2, Math.round(x.content.length / 500))} min read
                  </div>
                </div>
                <h3>
                  <Link
                    to={`/stories/${x.slug}`}
                    onClick={rememberHomeScrollPosition}
                  >
                    {x.title}
                  </Link>
                </h3>
                <RichText value={x.excerpt} className="cardRichSummary" />
                <div className="dailyBriefStoryFooter">
                  <div className="storyPrimaryActions">
                    <Link
                      className="cardReadStory"
                      to={`/stories/${x.slug}`}
                      onClick={rememberHomeScrollPosition}
                    >
                      Read Story <ArrowUpRight />
                    </Link>
                    <ShareStoryButton title={x.title} slug={x.slug} previewImage={photo} />
                  </div>
                  <div className="articleFoot">
                    <b>{x.author.name}</b>
                    <span>{x.views.toLocaleString()} views</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
function Home() {
  const [a, setA] = useState<Article[]>([]),
    [categories, setCategories] = useState<NewsCategory[]>([]),
    [selectedCategory, setSelectedCategory] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/categories")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    const query = selectedCategory
      ? `?categoryId=${encodeURIComponent(selectedCategory)}`
      : "";
    fetch("/api/articles" + query)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((items) => {
        if (current) setA(items);
      })
      .catch(() => {
        if (current) setA([]);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [selectedCategory]);
  useEffect(() => {
    if (loading) return;
    const saved = sessionStorage.getItem(homeScrollPositionKey);
    if (saved === null) return;
    sessionStorage.removeItem(homeScrollPositionKey);
    const position = Number(saved);
    if (!Number.isFinite(position)) return;
    let timeout = 0;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: position, behavior: "auto" });
      timeout = window.setTimeout(() => {
        window.scrollTo({ top: position, behavior: "auto" });
        if ("scrollRestoration" in history) history.scrollRestoration = "auto";
      }, 300);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [loading]);
  const selectedName = categories.find(
    (category) => category.id === selectedCategory,
  )?.name;
  return (
    <div>
      <Header
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <main>
        {loading ? (
          <section className="categoryState" aria-live="polite">
            <span></span>
            <h1>Loading stories…</h1>
            <p>Finding the latest published reporting.</p>
          </section>
        ) : a.length ? (
          <DailyBrief articles={a} />
        ) : (
          <section className="categoryState empty">
            <span></span>
            <h1>No published stories in {selectedName || "this category"}.</h1>
            <p>
              Choose another news category or return to all published stories.
            </p>
            {selectedCategory && (
              <button onClick={() => setSelectedCategory(null)}>
                Show all stories
              </button>
            )}
          </section>
        )}
        <NewsletterSignup />
      </main>
      <footer>
        <div className="brand light">
          <span>LN</span>
          <div>
            LOCAL NEWS<small>INDEPENDENT. ESSENTIAL.</small>
          </div>
        </div>
        <p>Reporting with context, accountability and care.</p>
        <small>© 2026 Local News. All rights reserved.</small>
      </footer>
    </div>
  );
}
const stats = [
  ["Published", "128", "+12%", FileText],
  ["In review", "14", "Needs attention", Clock],
  ["Monthly readers", "284K", "+18%", Users],
  ["Engagement", "68%", "+4.2%", BarChart3],
];
function Newsroom() {
  const nav = useNavigate();
  const [articles, setArticles] = useState(
    fallback.map((x, i) => ({ ...x, status: i ? "REVIEW" : "PUBLISHED" })),
  );
  const [action, setAction] = useState("");
  const update = (id: string, status: string) => {
    setArticles((v) => v.map((x) => (x.id === id ? { ...x, status } : x)));
    setAction(
      status === "PUBLISHED"
        ? "Article approved and published"
        : "Revision requested",
    );
  };
  return (
    <div className="dash">
      <aside>
        <Link to="/" className="brand light">
          <span>LN</span>
          <div>
            LOCAL NEWS<small>NEWSROOM OS</small>
          </div>
        </Link>
        <div className="workspace">
          <small>WORKSPACE</small>
          <b>Central News Desk</b>
        </div>
        {[
          [LayoutDashboard, "Overview"],
          [FileText, "Stories"],
          [Users, "People"],
          [BarChart3, "Analytics"],
          [Settings, "Settings"],
        ].map(([I, t]: any, i) => (
          <button className={i === 0 ? "active" : ""} key={t}>
            <I />
            {t}
            {t === "Stories" && <em>14</em>}
          </button>
        ))}
        <div className="profile">
          <div>HC</div>
          <span>
            <b>Harper Cole</b>
            <small>Administrator</small>
          </span>
        </div>
      </aside>
      <section className="content">
        <div className="top">
          <div>
            <small>SATURDAY, 11 JULY</small>
            <h1>Good evening, Harper.</h1>
            <p>Here’s what’s happening across your newsroom.</p>
          </div>
          <div>
            <button className="icon">
              <Bell />
            </button>
            <button className="new">
              <Plus /> New story
            </button>
          </div>
        </div>
        {action && (
          <div className="toast">
            {action}
            <button onClick={() => setAction("")}>×</button>
          </div>
        )}
        <div className="stats">
          {stats.map(([t, n, d, I]: any) => (
            <div className="stat" key={t}>
              <div>
                <small>{t}</small>
                <strong>{n}</strong>
                <span>{d}</span>
              </div>
              <I />
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panelHead">
            <div>
              <h2>Editorial queue</h2>
              <p>Stories requiring your attention</p>
            </div>
            <button>View all</button>
          </div>
          <div className="table">
            {articles.map((x) => (
              <div className="row" key={x.id}>
                <div className="story">
                  <div className="mini"></div>
                  <span>
                    <b>{x.title}</b>
                    <small>
                      {x.author.name} · {x.category.name}
                    </small>
                  </span>
                </div>
                <span className={"status " + x.status.toLowerCase()}>
                  {x.status.replace("_", " ")}
                </span>
                <span className="time">12 min ago</span>
                <div className="rowActions">
                  {x.status !== "PUBLISHED" && (
                    <>
                      <button
                        title="Approve"
                        onClick={() => update(x.id, "PUBLISHED")}
                      >
                        <CheckCircle2 />
                      </button>
                      <button
                        title="Request revision"
                        onClick={() => update(x.id, "REVISION")}
                      >
                        <XCircle />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lower">
          <div className="panel chart">
            <div className="panelHead">
              <div>
                <h2>Audience pulse</h2>
                <p>Readers over the last 7 days</p>
              </div>
              <b>284,621</b>
            </div>
            <div className="bars">
              {[42, 57, 48, 68, 62, 84, 76].map((h, i) => (
                <div key={i}>
                  <span style={{ height: h + "%" }}></span>
                  <small>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <div className="panel activity">
            <div className="panelHead">
              <div>
                <h2>Live desk</h2>
                <p>Recent newsroom activity</p>
              </div>
            </div>
            {[
              "Maya submitted “Cup semi-final”",
              "Daniel updated downtown report",
              "Aisha published council vote",
            ].map((x, i) => (
              <div className="event" key={x}>
                <span></span>
                <div>
                  <b>{x}</b>
                  <small>{i * 8 + 3} minutes ago</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
type SessionUser = {
  id: string;
  name: string;
  email: string;
  role:
    | "ADMIN"
    | "ADMIN_MEDICAL"
    | "EDITOR"
    | "DOCTOR"
    | "REPORTER"
    | "AUDIENCE"
    | "VOLUNTEER"
    | "DADE";
  roles?: string[];
};
type Session = { token: string; user: SessionUser };
const getSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem("ln_session") || "null");
  } catch {
    return null;
  }
};
const signOut = () => {
  localStorage.removeItem("ln_session");
  location.href = "/login";
};
function RequireAuth({ children, roles }: { children: any; roles?: string[] }) {
  const session = getSession(),
    where = useLocation();
  if (!session)
    return <Navigate to="/login" replace state={{ from: where.pathname }} />;
  if (roles && ![...(session.user.roles || []), session.user.role].some((role) => roles.includes(role)))
    return <Navigate to="/newsroom" replace />;
  return children;
}
function RequireMenu({ id, children }: { id: string; children: any }) {
  const visible = useMenuAccess();
  if (visible.loading) return null;
  return visible(id) ? children : <Navigate to="/newsroom" replace />;
}
function HomeBySession() {
  return getSession() ? <Navigate to="/newsroom" replace /> : <Home />;
}
function SessionSidebarMenu({ current }: { current: Session }) {
  const nav = useNavigate(),
    where = useLocation(),
    [updateResult, setUpdateResult] = useState<AppUpdateResult | null>(null),
    [canViewPeople, setCanViewPeople] = useState(false),
    [canManageRegistrations, setCanManageRegistrations] = useState(false);
  const appointmentCount = useActiveAppointmentCount(current.token, current.user.role === "DOCTOR");
  const hasTaggedPhotos = useTaggedPhotos(current.token, where.pathname);
  const visible = useMenuAccess();
  useEffect(() => {
    const receive = (event: Event) =>
      setUpdateResult((event as CustomEvent<AppUpdateResult>).detail);
    window.addEventListener(APP_UPDATE_RESULT_EVENT, receive);
    return () => window.removeEventListener(APP_UPDATE_RESULT_EVENT, receive);
  }, []);
  useEffect(() => {
    const headers = { Authorization: `Bearer ${current.token}` };
    Promise.all([
      fetch("/api/me", { headers }).then((response) =>
        response.ok ? response.json() : null,
      ),
      fetch("/api/registrations/capability", { headers }).then((response) =>
        response.ok ? response.json() : null,
      ),
    ])
      .then(([me, registration]) => {
        setCanViewPeople(me?.organizationLevel === "COOPERATION_LEADER");
        setCanManageRegistrations(Boolean(registration?.canAccess));
      })
      .catch(() => {
        setCanViewPeople(false);
        setCanManageRegistrations(false);
      });
  }, [current.user.id, current.token]);
  const role = current.user.role,
    overviewPath =
      role === "ADMIN_MEDICAL" ? "/newsroom/health/events" : "/newsroom",
    appointmentPath =
      role === "DOCTOR"
        ? "/newsroom/doctor/appointments"
        : ["ADMIN", "ADMIN_MEDICAL"].includes(role)
          ? "/newsroom/health/appointments"
          : "/newsroom/appointments",
    updating = ["checking", "updating"].includes(updateResult?.status || ""),
    updateLabel =
      updateResult?.status === "checking"
        ? "Checking…"
        : updateResult?.status === "updating"
          ? "Updating…"
          : updateResult?.status === "latest"
            ? "Up to date"
            : updateResult?.status === "error"
              ? "Try again"
              : "Update App";
  const go = (path: string) => nav(path);
  const peoplePath = visible.configured
    ? "/newsroom/users"
    : "/newsroom/people";
  return (
    <>
      <LanguageDropdown className="sidebarLanguageDropdown" />
      {visible("overview") && (
        <button
          className={
            where.pathname === overviewPath
              ? "sessionCommonSidebarButton active"
              : "sessionCommonSidebarButton"
          }
          onClick={() => go(overviewPath)}
        >
          <LayoutDashboard />
          Overview
        </button>
      )}
      {visible("stories") && (
        <button
          className={
            where.pathname === "/newsroom/stories"
              ? "sessionCommonSidebarButton active"
              : "sessionCommonSidebarButton"
          }
          onClick={() => go("/newsroom/stories")}
        >
          <FileText />
          Stories
        </button>
      )}
      {visible("people") && (visible.configured || canViewPeople) && (
        <button
          className={
            where.pathname === peoplePath
              ? "sessionCommonSidebarButton active"
              : "sessionCommonSidebarButton"
          }
          onClick={() => go(peoplePath)}
        >
          <Users />
          People
        </button>
      )}
      {visible("registrations") &&
        (visible.configured || canManageRegistrations) && (
          <button
            className={
              where.pathname === "/newsroom/registrations"
                ? "sessionCommonSidebarButton active"
                : "sessionCommonSidebarButton"
            }
            onClick={() => go("/newsroom/registrations")}
          >
            <ClipboardList />
            Registration
          </button>
        )}
      {visible("talk_with_doc") && (
        <button
          className={
            where.pathname === "/newsroom/health-services"
              ? "sessionCommonSidebarButton active"
              : "sessionCommonSidebarButton"
          }
          onClick={() => go("/newsroom/health-services")}
        >
          <CalendarHeart />
          Talk With Doc
        </button>
      )}
      {visible("health_events") && (
        <button
          className={
            where.pathname === "/newsroom/health/events"
              ? "sessionCommonSidebarButton active"
              : "sessionCommonSidebarButton"
          }
          onClick={() => go("/newsroom/health/events")}
        >
          <CalendarDays />
          Events
        </button>
      )}
      {visible("appointments") && (
        <button
          className={
            where.pathname === appointmentPath
              ? "sessionCommonSidebarButton active"
              : "sessionCommonSidebarButton"
          }
          onClick={() => go(appointmentPath)}
        >
          <CalendarCheck2 />
          Appointments
          {appointmentCount > 0 && <em>{appointmentCount}</em>}
        </button>
      )}
      {visible("photos") && hasTaggedPhotos && <button className={`sessionCommonSidebarButton${where.pathname === "/newsroom/photos" ? " active" : ""}`} onClick={() => go("/newsroom/photos")}><FileText />Photos / 照片</button>}
      {visible("doctors") && (
        <button
          className={
            where.pathname === "/newsroom/health/doctors"
              ? "sessionCommonSidebarButton active"
              : "sessionCommonSidebarButton"
          }
          onClick={() => go("/newsroom/health/doctors")}
        >
          <Stethoscope />
          Doctors
        </button>
      )}
      {visible("settings") && (
        <button
          className={
            where.pathname === "/newsroom/settings"
              ? "sessionCommonSidebarButton active"
              : "sessionCommonSidebarButton"
          }
          onClick={() => go("/newsroom/settings")}
        >
          <Settings />
          Settings
        </button>
      )}
      {visible("settings_organizations") && (
        <button
          className="sessionCommonSidebarButton adminUnifiedSubnav"
          onClick={() => go("/newsroom/departments")}
        >
          <Building2 />
          Organizations
        </button>
      )}
      {visible("settings_org_chart") && (
        <button
          className="sessionCommonSidebarButton adminUnifiedSubnav"
          onClick={() => go("/newsroom/org-chart")}
        >
          <Network />
          Organization Chart
        </button>
      )}
      {visible("settings_areas") && (
        <button
          className="sessionCommonSidebarButton adminUnifiedSubnav"
          onClick={() => go("/newsroom/areas")}
        >
          <MapPinned />
          Areas
        </button>
      )}
      {visible("settings_categories") && (
        <button
          className="sessionCommonSidebarButton adminUnifiedSubnav"
          onClick={() => go("/newsroom/categories")}
        >
          <Tag />
          News Categories
        </button>
      )}
      {visible("settings_jingsi") && (
        <button
          className="sessionCommonSidebarButton adminUnifiedSubnav"
          onClick={() => go("/newsroom/jingsi")}
        >
          <Quote />
          JingSi
        </button>
      )}
      {visible("settings_languages") && (
        <button
          className="sessionCommonSidebarButton adminUnifiedSubnav"
          onClick={() => go("/newsroom/languages")}
        >
          <Languages />
          Language Mapping
        </button>
      )}
      {visible("settings_roles") && (
        <button
          className="sessionCommonSidebarButton adminUnifiedSubnav"
          onClick={() => go("/newsroom/roles")}
        >
          <ShieldCheck />
          Roles
        </button>
      )}
      {visible("logout") && (
        <button
          className="sessionCommonSidebarButton sessionCommonLogout"
          onClick={signOut}
        >
          <LogOut />
          Logout
        </button>
      )}
      {visible("update_app") && (
        <>
          <button
            className="sessionCommonSidebarButton sessionCommonUpdate"
            disabled={updating}
            onClick={() =>
              window.dispatchEvent(new Event(CHECK_APP_UPDATE_EVENT))
            }
          >
            <RefreshCw className={updating ? "spinning" : ""} />
            {updateLabel}
          </button>
          <small className="sessionCommonVersion">
            Version {__APP_VERSION__}
          </small>
        </>
      )}
    </>
  );
}
function AdminSidebarMenu({ current }: { current: Session }) {
  const where = useLocation(),
    medicalOnly = current.user.role === "ADMIN_MEDICAL",
    [updateResult, setUpdateResult] = useState<AppUpdateResult | null>(null);
  const visible = useMenuAccess();
  const hasTaggedPhotos = useTaggedPhotos(current.token, where.pathname);
  useEffect(() => {
    const receive = (event: Event) =>
      setUpdateResult((event as CustomEvent<AppUpdateResult>).detail);
    window.addEventListener(APP_UPDATE_RESULT_EVENT, receive);
    return () => window.removeEventListener(APP_UPDATE_RESULT_EVENT, receive);
  }, []);
  const active = (path: string) =>
    where.pathname === path
      ? "sessionCommonSidebarButton active"
      : "sessionCommonSidebarButton";
  const settingsPaths = [
    "/newsroom/settings",
    "/newsroom/departments",
    "/newsroom/org-chart",
    "/newsroom/areas",
    "/newsroom/categories",
    "/newsroom/jingsi",
    "/newsroom/languages",
    "/newsroom/roles",
  ];
  const updating = ["checking", "updating"].includes(
    updateResult?.status || "",
  );
  const updateLabel =
    updateResult?.status === "checking"
      ? "Checking…"
      : updateResult?.status === "updating"
        ? "Updating…"
        : updateResult?.status === "latest"
          ? "Up to date"
          : updateResult?.status === "error"
            ? "Try again"
            : "Update App";
  return (
    <>
      <Link
        to={medicalOnly ? "/newsroom/health/events" : "/newsroom"}
        className="brand light"
      >
        <span>LN</span>
        <div>
          LOCAL NEWS
          <small>{medicalOnly ? "MEDICAL ADMIN" : "NEWSROOM OS"}</small>
        </div>
      </Link>
      <div className="workspace adminUnifiedWorkspace">
        <small>WORKSPACE</small>
        <b>{current.user.name}</b>
        <span>{medicalOnly ? "Admin Medical" : "Administrator"}</span>
      </div>
      <LanguageDropdown className="sidebarLanguageDropdown" />
      {!medicalOnly && (
        <>
          {visible("overview") && (
            <Link className={active("/newsroom")} to="/newsroom">
              <LayoutDashboard />
              Overview
            </Link>
          )}
          {visible("stories") && (
            <Link
              className={active("/newsroom/stories")}
              to="/newsroom/stories"
            >
              <FileText />
              Stories
            </Link>
          )}
          {visible("people") && (
            <Link className={active("/newsroom/users")} to="/newsroom/users">
              <Users />
              People
            </Link>
          )}
          {visible("registrations") && (
            <Link
              className={active("/newsroom/registrations")}
              to="/newsroom/registrations"
            >
              <ClipboardList />
              Registration
            </Link>
          )}
        </>
      )}
      {(visible("health_events") ||
        visible("appointments") ||
        visible("doctors")) && (
        <div className="healthNavLabel">Talk With Doc</div>
      )}
      {visible("health_events") && (
        <Link
          className={active("/newsroom/health/events")}
          to="/newsroom/health/events"
        >
          <CalendarDays />
          Events
        </Link>
      )}
      {visible("appointments") && (
        <Link
          className={active("/newsroom/health/appointments")}
          to="/newsroom/health/appointments"
        >
          <ClipboardList />
          Appointments
        </Link>
      )}
      {visible("photos") && hasTaggedPhotos && <Link className={active("/newsroom/photos")} to="/newsroom/photos"><FileText />Photos / 照片</Link>}
      {visible("doctors") && (
        <Link
          className={active("/newsroom/health/doctors")}
          to="/newsroom/health/doctors"
        >
          <Stethoscope />
          Doctors
        </Link>
      )}
      {!medicalOnly && (
        <>
          {visible("analytics") && (
            <button
              className="sessionCommonSidebarButton"
              type="button"
              disabled
              title="Analytics dashboard coming soon"
            >
              <BarChart3 />
              Analytics
            </button>
          )}
          {visible("settings") && (
            <Link
              className={
                settingsPaths.includes(where.pathname)
                  ? "sessionCommonSidebarButton active"
                  : "sessionCommonSidebarButton"
              }
              to="/newsroom/settings"
            >
              <Settings />
              Settings
            </Link>
          )}
          {visible("settings_organizations") && (
            <Link
              className={
                active("/newsroom/departments") + " adminUnifiedSubnav"
              }
              to="/newsroom/departments"
            >
              <Building2 />
              Organizations
            </Link>
          )}
          {visible("settings_org_chart") && (
            <Link
              className={active("/newsroom/org-chart") + " adminUnifiedSubnav"}
              to="/newsroom/org-chart"
            >
              <Network />
              Organization Chart
            </Link>
          )}
          {visible("settings_areas") && (
            <Link
              className={active("/newsroom/areas") + " adminUnifiedSubnav"}
              to="/newsroom/areas"
            >
              <MapPinned />
              Areas
            </Link>
          )}
          {visible("settings_categories") && (
            <Link
              className={active("/newsroom/categories") + " adminUnifiedSubnav"}
              to="/newsroom/categories"
            >
              <Tag />
              News Categories
            </Link>
          )}
          {visible("settings_jingsi") && (
            <Link
              className={active("/newsroom/jingsi") + " adminUnifiedSubnav"}
              to="/newsroom/jingsi"
            >
              <Quote />
              JingSi
            </Link>
          )}
          {visible("settings_languages") && (
            <Link
              className={active("/newsroom/languages") + " adminUnifiedSubnav"}
              to="/newsroom/languages"
            >
              <Languages />
              Language Mapping
            </Link>
          )}
          {visible("settings_roles") && (
            <Link
              className={active("/newsroom/roles") + " adminUnifiedSubnav"}
              to="/newsroom/roles"
            >
              <ShieldCheck />
              Roles
            </Link>
          )}
        </>
      )}
      {visible("logout") && (
        <button
          className="sessionCommonSidebarButton sessionCommonLogout"
          onClick={signOut}
        >
          <LogOut />
          Logout
        </button>
      )}
      {visible("update_app") && (
        <>
          <button
            className="sessionCommonSidebarButton sessionCommonUpdate"
            disabled={updating}
            onClick={() =>
              window.dispatchEvent(new Event(CHECK_APP_UPDATE_EVENT))
            }
          >
            <RefreshCw className={updating ? "spinning" : ""} />
            {updateLabel}
          </button>
          <small className="sessionCommonVersion">
            Version {__APP_VERSION__}
          </small>
        </>
      )}
    </>
  );
}
type SidebarAccountDetails = {
  harmonyGroup?: { name: string } | null;
  mutualLoveGroup?: { name: string } | null;
  cooperationUnit?: { name: string } | null;
};
function SessionAccountWorkspace({ current }: { current: Session }) {
  const [account, setAccount] = useState<SidebarAccountDetails | null>(null);
  useEffect(() => {
    fetch("/api/me", { headers: { Authorization: `Bearer ${current.token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then(setAccount)
      .catch(() => setAccount(null));
  }, [current.user.id, current.token]);
  return (
    <>
      <span className="sessionAccountLabel">MY ACCOUNT</span>
      <b>{current.user.name}</b>
      <small>{current.user.role.replaceAll("_", " ")}</small>
      <div className="accountHierarchyRows">
        <span>
          <i>Harmony</i>
          <strong>{account?.harmonyGroup?.name || "Unassigned"}</strong>
        </span>
        <span>
          <i>MutualLove</i>
          <strong>{account?.mutualLoveGroup?.name || "Unassigned"}</strong>
        </span>
        <span>
          <i>Cooperation</i>
          <strong>{account?.cooperationUnit?.name || "Unassigned"}</strong>
        </span>
      </div>
    </>
  );
}
function SessionControl() {
  const where = useLocation(),
    current = getSession(),
    isStoryPreview = /^\/newsroom\/stories\/[^/]+\/preview\/?$/.test(
      where.pathname,
    ),
    isAdminSession = Boolean(
      current && ["ADMIN", "ADMIN_MEDICAL"].includes(current.user.role),
    ),
    [hosts, setHosts] = useState<{
      menu: HTMLElement;
      workspace?: HTMLElement;
    } | null>(null),
    [sidebarRetry, setSidebarRetry] = useState(0);
  useEffect(() => {
    if (!current || !where.pathname.startsWith("/newsroom") || isStoryPreview)
      return;
    const aside = document.querySelector<HTMLElement>(".dash aside"),
      workspace = aside?.querySelector<HTMLElement>(".workspace");
    if (!aside) {
      const retry = window.setTimeout(
        () => setSidebarRetry((value) => value + 1),
        40,
      );
      return () => window.clearTimeout(retry);
    }
    const menu = document.createElement("div");
    if (isAdminSession) {
      menu.className = "adminUnifiedSidebarPortal";
      aside.append(menu);
      aside.classList.add("adminUnifiedSidebar");
      setHosts({ menu });
      return () => {
        menu.remove();
        aside.classList.remove(
          "adminUnifiedSidebar",
          "sessionMobileSidebarOpen",
        );
        setHosts(null);
      };
    }
    menu.className = "sessionCommonSidebarPortal";
    const profile = aside.querySelector(":scope > .profile");
    profile ? aside.insertBefore(menu, profile) : aside.append(menu);
    const brand = aside.querySelector(":scope > .brand");
    const hidden = Array.from(aside.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child !== brand &&
        child !== workspace &&
        child !== menu,
    );
    hidden.forEach((item) => item.classList.add("sessionCommonOriginal"));
    aside.classList.add("sessionUnifiedSidebar");
    let workspaceHost: HTMLElement | undefined;
    if (workspace) {
      workspaceHost = document.createElement("div");
      workspaceHost.className = "adminWorkspacePortal";
      workspace.append(workspaceHost);
    }
    setHosts({ menu, workspace: workspaceHost });
    return () => {
      hidden.forEach((item) => item.classList.remove("sessionCommonOriginal"));
      menu.remove();
      workspaceHost?.remove();
      aside.classList.remove(
        "sessionUnifiedSidebar",
        "sessionMobileSidebarOpen",
      );
      setHosts(null);
    };
  }, [
    where.pathname,
    current?.user.id,
    current?.user.role,
    isStoryPreview,
    isAdminSession,
    sidebarRetry,
  ]);
  if (
    !current ||
    !where.pathname.startsWith("/newsroom") ||
    isStoryPreview ||
    !hosts
  )
    return null;
  if (isAdminSession)
    return createPortal(<AdminSidebarMenu current={current} />, hosts.menu);
  return (
    <>
      {createPortal(<SessionSidebarMenu current={current} />, hosts.menu)}
      {hosts.workspace &&
        createPortal(
          <SessionAccountWorkspace current={current} />,
          hosts.workspace,
        )}
    </>
  );
}
function AuthenticatedHeader() {
  const where = useLocation(),
    current = getSession(),
    isStoryPreview = /^\/newsroom\/stories\/[^/]+\/preview\/?$/.test(
      where.pathname,
    );
  if (!current || !where.pathname.startsWith("/newsroom") || isStoryPreview)
    return null;
  const openMenu = () => {
    window.dispatchEvent(new Event("local-news:open-reader-menu"));
    document
      .querySelector<HTMLElement>(".dash aside")
      ?.classList.toggle("sessionMobileSidebarOpen");
  };
  return (
    <div className="readerDashboardShell sessionHeaderShell">
      <PublicHeader
        className="homeHeader audienceDashboardHeader"
        hideSessionActions
        onMenu={openMenu}
      />
    </div>
  );
}
function Login() {
  const nav = useNavigate(),
    where = useLocation();
  const [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [changeToken, setChangeToken] = useState(""),
    [accountName, setAccountName] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [recovering, setRecovering] = useState(false),
    [recoveryName, setRecoveryName] = useState(""),
    [resetToken, setResetToken] = useState(""),
    [success, setSuccess] = useState(""),
    [signingUp, setSigningUp] = useState(
      () => new URLSearchParams(where.search).get("mode") === "signup",
    );
  useEffect(() => {
    if (getSession()) nav("/newsroom", { replace: true });
  }, []);
  const completeLogin = (data: any) => {
    localStorage.setItem("ln_session", JSON.stringify(data));
    nav((where.state as any)?.from || "/newsroom", { replace: true });
  };
  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const changing = Boolean(changeToken),
        resetting = Boolean(resetToken),
        verifyingRecovery = recovering && !resetting,
        endpoint = changing
          ? "/api/auth/change-default-password"
          : resetting
            ? "/api/auth/forgot-password/reset"
            : verifyingRecovery
              ? "/api/auth/forgot-password/verify"
              : "/api/auth/login",
        requestBody = changing
          ? {
              passwordChangeToken: changeToken,
              newPassword,
              confirmPassword,
            }
          : resetting
            ? {
                passwordResetToken: resetToken,
                newPassword,
                confirmPassword,
              }
            : verifyingRecovery
              ? { identifier, fullName: recoveryName }
              : { identifier, password },
        r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error || "Sign in failed");
      if (verifyingRecovery) {
        setResetToken(data.passwordResetToken);
        setAccountName(data.user?.name || recoveryName);
        setNewPassword("");
        setConfirmPassword("");
        return;
      }
      if (resetting) {
        setRecovering(false);
        setResetToken("");
        setRecoveryName("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccess("Password reset successful. Sign in with your new password.");
        return;
      }
      if (data.requiresPasswordChange) {
        setChangeToken(data.passwordChangeToken);
        setAccountName(data.user?.name || "");
        setPassword("");
        return;
      }
      completeLogin(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const passwordForm = Boolean(changeToken || resetToken);
  const cancelRecovery = () => {
    setRecovering(false);
    setResetToken("");
    setRecoveryName("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };
  return (
    <div className="loginPage">
      <section className="loginStory">
        <Link to="/" className="brand light">
          <span>LN</span>
          <div>
            LOCAL NEWS<small>NEWSROOM OS</small>
          </div>
        </Link>
        <div className="loginMessage">
          <span>INDEPENDENT JOURNALISM</span>
          <h1>The city’s story starts here.</h1>
          <p>A secure workspace for editors, reporters and newsroom leaders.</p>
        </div>
        <small>LOCAL NEWS · CENTRAL DESK</small>
      </section>
      <section className="loginPanel">
        {signingUp ? (
          <SignUpForm
            onCancel={() => {
              setSigningUp(false);
              setError("");
            }}
            onRegistered={completeLogin}
          />
        ) : (
          <form onSubmit={submit}>
            <div className="loginTitle">
              <small
                key={
                  changeToken ? "security" : recovering ? "recovery" : "welcome"
                }
              >
                {changeToken
                  ? "SECURITY REQUIRED"
                  : recovering
                    ? "ACCOUNT RECOVERY"
                    : "WELCOME BACK"}
              </small>
              <h2
                key={passwordForm ? "new-password" : recovering ? "reset" : "sign-in"}
              >
                {passwordForm
                  ? "Create a new password"
                  : recovering
                    ? "Reset your password"
                  : "Sign in to the newsroom"}
              </h2>
              <p
                key={
                  changeToken
                    ? "default-password-copy"
                    : resetToken
                      ? "reset-password-copy"
                      : recovering
                        ? "recovery-copy"
                        : "login-copy"
                }
              >
                {changeToken
                  ? `${accountName}, you must replace the default password before continuing.`
                  : resetToken
                    ? `${accountName}, enter and confirm your new password.`
                    : recovering
                      ? "Enter your registered email or contact and exact registered full name."
                  : "First-time users can enter only their email or contact, then select Sign in."}
              </p>
            </div>
            {error && <div className="loginError">{error}</div>}
            {success && <div className="loginSuccess">{success}</div>}
            {passwordForm ? (
              <Fragment key={changeToken ? "default-password" : "password-reset"}>
                <label>
                  New password
                  <div className="loginInput">
                    <Lock />
                    <input
                      autoFocus
                      required
                      minLength={8}
                      maxLength={72}
                      type={show ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </label>
                <label>
                  Confirm password
                  <div className="loginInput">
                    <ShieldCheck />
                    <input
                      required
                      minLength={8}
                      maxLength={72}
                      type={show ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </label>
                <button className="loginSubmit" disabled={busy}>
                  {busy
                    ? resetToken
                      ? "Resetting password…"
                      : "Updating password…"
                    : resetToken
                      ? "Reset password"
                      : "Save password and continue"}
                  <ArrowUpRight />
                </button>
                {resetToken && (
                  <button
                    className="loginRecoveryBack"
                    type="button"
                    onClick={cancelRecovery}
                  >
                    Back to sign in
                  </button>
                )}
              </Fragment>
            ) : recovering ? (
              <Fragment key="recovery-verification">
                <label>
                  Email or contact
                  <div className="loginInput">
                    <Mail />
                    <input
                      autoFocus
                      required
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </label>
                <label>
                  Registered full name
                  <div className="loginInput">
                    <Users />
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      type="text"
                      value={recoveryName}
                      onChange={(e) => setRecoveryName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                </label>
                <button className="loginSubmit" disabled={busy}>
                  {busy ? "Verifying…" : "Verify registered credential"}
                  <ArrowUpRight />
                </button>
                <button
                  className="loginRecoveryBack"
                  type="button"
                  onClick={cancelRecovery}
                >
                  Back to sign in
                </button>
              </Fragment>
            ) : (
              <Fragment key="login">
                <label>
                  Email or contact
                  <div className="loginInput">
                    <Mail />
                    <input
                      autoFocus
                      required
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username webauthn"
                    />
                  </div>
                </label>
                <label>
                  Password <small>(not required for first login)</small>
                  <div className="loginInput">
                    <Lock />
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </label>
                <div className="loginOptions">
                  <label>
                    <input type="checkbox" defaultChecked /> Keep me signed in
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRecovering(true);
                      setError("");
                      setSuccess("");
                      setPassword("");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="loginSubmitRow">
                  <LanguageDropdown className="loginLanguageDropdown" />
                  <button className="loginSubmit" disabled={busy}>
                    {busy ? "Signing in…" : "Sign in"}
                    <ArrowUpRight />
                  </button>
                </div>
                <PasskeyLoginButton
                  onAuthenticated={completeLogin}
                  onError={setError}
                />
                <div className="loginSignupPrompt">
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setSigningUp(true);
                      setError("");
                      setSuccess("");
                    }}
                  >
                    Sign up for an account
                  </button>
                </div>
              </Fragment>
            )}
            <Link className="backHome" to="/">
              ← Return to Local News
            </Link>
          </form>
        )}
      </section>
    </div>
  );
}
type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "REPORTER" | "AUDIENCE";
  locked: boolean;
  createdAt: string;
  _count?: { articles: number };
};
const roleLabel = (role: string) =>
  role.charAt(0) + role.slice(1).toLowerCase();
function UserManagement() {
  const nav = useNavigate();
  const session = getSession()!;
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [token] = useState(session.token);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [notice, setNotice] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "REPORTER",
    password: "Demo123!",
  });
  const call = async (url: string, options: RequestInit = {}) => {
    const r = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({}))).error || "Request failed",
      );
    return r.status === 204 ? null : r.json();
  };
  useEffect(() => {
    fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) {
          signOut();
          throw new Error();
        }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setUsers)
      .catch(() => setNotice("Could not load the user directory"))
      .finally(() => setBusy(false));
  }, [token]);
  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          (role === "ALL" || u.role === role) &&
          `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [users, query, role],
  );
  const flash = (x: string) => {
    setNotice(x);
    setTimeout(() => setNotice(""), 2800);
  };
  const update = async (u: ManagedUser, data: Partial<ManagedUser>) => {
    try {
      const next = await call(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setUsers((v) => v.map((x) => (x.id === u.id ? next : x)));
      flash("User account updated");
    } catch (e: any) {
      flash(e.message);
    }
  };
  const remove = async (u: ManagedUser) => {
    if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try {
      await call(`/api/users/${u.id}`, { method: "DELETE" });
      setUsers((v) => v.filter((x) => x.id !== u.id));
      flash("User removed");
    } catch (e: any) {
      flash(e.message);
    }
  };
  const create = async (e: any) => {
    e.preventDefault();
    try {
      const next = await call("/api/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setUsers((v) => [next, ...v]);
      setShowAdd(false);
      setForm({ name: "", email: "", role: "REPORTER", password: "Demo123!" });
      flash("New user invited successfully");
    } catch (e: any) {
      flash(e.message);
    }
  };
  return (
    <div className="dash">
      <aside>
        <Link to="/" className="brand light">
          <span>LN</span>
          <div>
            LOCAL NEWS<small>NEWSROOM OS</small>
          </div>
        </Link>
        <div className="workspace">
          <small>WORKSPACE</small>
          <b>Central News Desk</b>
        </div>
        <button onClick={() => nav("/newsroom")}>
          <LayoutDashboard />
          Overview
        </button>
        <button>
          <FileText />
          Stories<em>14</em>
        </button>
        <button className="active">
          <Users />
          People
        </button>
        <button>
          <BarChart3 />
          Analytics
        </button>
        <button>
          <Settings />
          Settings
        </button>
        <div className="profile">
          <div>HC</div>
          <span>
            <b>Harper Cole</b>
            <small>Administrator</small>
          </span>
        </div>
      </aside>
      <section className="content usersPage">
        <div className="top">
          <div>
            <small>ADMINISTRATION / PEOPLE</small>
            <h1>User management</h1>
            <p>Manage newsroom access, roles and account status.</p>
          </div>
          <div>
            <button className="new" onClick={() => setShowAdd(true)}>
              <Plus /> Add user
            </button>
          </div>
        </div>
        {notice && (
          <div className="toast">
            {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}
        <div className="userSummary">
          <div>
            <span className="summaryIcon">
              <Users />
            </span>
            <b>{users.length}</b>
            <small>Total people</small>
          </div>
          <div>
            <span className="summaryIcon editor">
              <FileText />
            </span>
            <b>{users.filter((x) => x.role === "EDITOR").length}</b>
            <small>Editors</small>
          </div>
          <div>
            <span className="summaryIcon reporter">
              <Mail />
            </span>
            <b>{users.filter((x) => x.role === "REPORTER").length}</b>
            <small>Reporters</small>
          </div>
          <div>
            <span className="summaryIcon locked">
              <Lock />
            </span>
            <b>{users.filter((x) => x.locked).length}</b>
            <small>Locked accounts</small>
          </div>
        </div>
        <div className="panel userPanel">
          <div className="userTools">
            <div className="userSearch">
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email"
                aria-label="Search users"
              />
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-label="Filter by role"
            >
              <option value="ALL">All roles</option>
              {["ADMIN", "EDITOR", "REPORTER", "AUDIENCE"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <span>{filtered.length} people</span>
          </div>
          <div className="userTable">
            <div className="userRow userHeader">
              <span>Person</span>
              <span>Role</span>
              <span>Stories</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {busy ? (
              <div className="emptyState">Loading newsroom people…</div>
            ) : (
              filtered.map((u) => (
                <div className="userRow" key={u.id}>
                  <div className="person">
                    <span className="avatar">
                      {u.name
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <span>
                      <b>{u.name}</b>
                      <small>{u.email}</small>
                    </span>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) =>
                      update(u, { role: e.target.value as ManagedUser["role"] })
                    }
                    aria-label={`Role for ${u.name}`}
                  >
                    {["ADMIN", "EDITOR", "REPORTER", "AUDIENCE"].map((x) => (
                      <option key={x} value={x}>
                        {roleLabel(x)}
                      </option>
                    ))}
                  </select>
                  <span className="storyCount">{u._count?.articles || 0}</span>
                  <button
                    className={"accountState " + (u.locked ? "isLocked" : "")}
                    onClick={() => update(u, { locked: !u.locked })}
                  >
                    {u.locked ? (
                      <>
                        <Lock />
                        Locked
                      </>
                    ) : (
                      <>
                        <CheckCircle2 />
                        Active
                      </>
                    )}
                  </button>
                  <div className="manageActions">
                    <button
                      title={u.locked ? "Unlock account" : "Lock account"}
                      onClick={() => update(u, { locked: !u.locked })}
                    >
                      {u.locked ? <Unlock /> : <Lock />}
                    </button>
                    <button
                      className="danger"
                      title="Delete user"
                      onClick={() => remove(u)}
                      disabled={u.email === "admin@local.news"}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              ))
            )}
            {!busy && !filtered.length && (
              <div className="emptyState">No people match those filters.</div>
            )}
          </div>
        </div>
      </section>
      {showAdd && (
        <div className="modalBackdrop" onMouseDown={() => setShowAdd(false)}>
          <form
            className="userModal"
            onSubmit={create}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modalHead">
              <div>
                <small>NEW TEAM MEMBER</small>
                <h2>Add a newsroom user</h2>
              </div>
              <button type="button" onClick={() => setShowAdd(false)}>
                ×
              </button>
            </div>
            <label>
              Full name
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Lena Morrison"
              />
            </label>
            <label>
              Email address
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="lena@local.news"
              />
            </label>
            <div className="formPair">
              <label>
                Role
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {["EDITOR", "REPORTER", "AUDIENCE", "ADMIN"].map((x) => (
                    <option key={x} value={x}>
                      {roleLabel(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Temporary password
                <input
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </label>
            </div>
            <p>
              The user can sign in immediately with this temporary password.
            </p>
            <div className="modalActions">
              <button type="button" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="new" type="submit">
                Create user
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function PeopleNavigation() {
  const nav = useNavigate();
  useEffect(() => {
    const button = document.querySelectorAll<HTMLButtonElement>(
      ".dash aside > button",
    )[2];
    if (!button) return;
    const open = () => nav("/newsroom/users");
    button.addEventListener("click", open);
    button.setAttribute("aria-label", "Open User Management");
    return () => button.removeEventListener("click", open);
  }, [nav]);
  return null;
}
function DepartmentSidebarNav() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
        ".dash aside > button",
      ),
      settings = buttons[buttons.length - 1],
      profile = document.querySelector<HTMLElement>(".dash aside .profile");
    if (!settings) return;
    const mount = document.createElement("div");
    mount.className = "sidebarPortal settingsSubnav";
    settings.classList.add("settingsParentButton");
    profile?.classList.add("sidebarProfileLast");
    settings.after(mount);
    setHost(mount);
    return () => {
      mount.remove();
      settings.classList.remove("settingsParentButton");
      profile?.classList.remove("sidebarProfileLast");
    };
  }, []);
  return host
    ? createPortal(
        <>
          <a
            className="departmentSidebarLink"
            href="/newsroom/departments"
            aria-label="Open Organization Management"
          >
            <Building2 />
            Organizations
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/org-chart"
            aria-label="Open Organization Chart Maintenance"
          >
            <Network />
            Organization Chart
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/categories"
            aria-label="Open News Category Management"
          >
            <Tag />
            News Categories
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/jingsi"
            aria-label="Open JingSi Management"
          >
            <Quote />
            JingSi / 靜思
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/languages"
            aria-label="Open Language Mapping"
          >
            <Languages />
            Language Mapping
          </a>
        </>,
        host,
      )
    : null;
}
function DepartmentSidebarLayout() {
  useEffect(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
        ".dash aside > button",
      ),
      department = buttons[3],
      settings = buttons[5],
      profile = document.querySelector<HTMLElement>(".dash aside .profile");
    if (!department || !settings) return;
    department.classList.add("settingsSubnavButton");
    settings.classList.add("settingsParentButton");
    profile?.classList.add("sidebarProfileLast");
    return () => {
      department.classList.remove("settingsSubnavButton");
      settings.classList.remove("settingsParentButton");
      profile?.classList.remove("sidebarProfileLast");
    };
  }, []);
  return null;
}
function OrgChartLinkForOrganizationPage() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const organization = document.querySelectorAll<HTMLButtonElement>(
      ".dash aside > button",
    )[3];
    if (!organization) return;
    const mount = document.createElement("div");
    mount.className = "sidebarPortal settingsSubnav orgChartInjected";
    organization.after(mount);
    setHost(mount);
    return () => mount.remove();
  }, []);
  return host
    ? createPortal(
        <>
          <a
            className="departmentSidebarLink"
            href="/newsroom/org-chart"
            aria-label="Open Organization Chart Maintenance"
          >
            <Network />
            Organization Chart
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/categories"
            aria-label="Open News Category Management"
          >
            <Tag />
            News Categories
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/jingsi"
            aria-label="Open JingSi Management"
          >
            <Quote />
            JingSi / 靜思
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/languages"
            aria-label="Open Language Mapping"
          >
            <Languages />
            Language Mapping
          </a>
        </>,
        host,
      )
    : null;
}
function CategoryLinkForOrgChartPage() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const chart = document.querySelectorAll<HTMLButtonElement>(
      ".dash aside > button",
    )[4];
    if (!chart) return;
    const mount = document.createElement("div");
    mount.className = "sidebarPortal settingsSubnav orgChartInjected";
    chart.after(mount);
    setHost(mount);
    return () => mount.remove();
  }, []);
  return host
    ? createPortal(
        <>
          <a
            className="departmentSidebarLink"
            href="/newsroom/categories"
            aria-label="Open News Category Management"
          >
            <Tag />
            News Categories
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/jingsi"
            aria-label="Open JingSi Management"
          >
            <Quote />
            JingSi / 靜思
          </a>
          <a
            className="departmentSidebarLink"
            href="/newsroom/languages"
            aria-label="Open Language Mapping"
          >
            <Languages />
            Language Mapping
          </a>
        </>,
        host,
      )
    : null;
}
function OrgChartSidebarLayout() {
  useEffect(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
        ".dash aside > button",
      ),
      organization = buttons[3],
      chart = buttons[4],
      settings = buttons[6],
      profile = document.querySelector<HTMLElement>(".dash aside .profile");
    if (!organization || !chart || !settings) return;
    organization.classList.add("settingsSubnavButton");
    chart.classList.add("settingsSubnavButton", "orgChartActiveButton");
    settings.classList.add("settingsParentButton");
    profile?.classList.add("sidebarProfileLast");
    return () => {
      organization.classList.remove("settingsSubnavButton");
      chart.classList.remove("settingsSubnavButton", "orgChartActiveButton");
      settings.classList.remove("settingsParentButton");
      profile?.classList.remove("sidebarProfileLast");
    };
  }, []);
  return null;
}
function OrganizationRouteGuard() {
  useEffect(() => {
    const handler = (event: Event) => {
      const el = (event.target as HTMLElement)?.closest("a,button");
      if (!el) return;
      const label = (el.textContent || "").trim();
      if (label === "Organizations" || label === "组织") {
        event.preventDefault();
        location.assign("/newsroom/departments");
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);
  return null;
}
function NewsroomByRole() {
  const s = getSession();
  const visible = useMenuAccess();
  if (visible.loading) return null;
  if (s?.user.role === "ADMIN_MEDICAL")
    return <Navigate to="/newsroom/health/events" replace />;
  if (visible("overview")) return <AudienceHomepageDashboard />;
  if (visible("stories")) return <Navigate to="/newsroom/stories" replace />;
  if (visible("talk_with_doc")) return <Navigate to="/newsroom/health-services" replace />;
  if (visible("appointments")) return <Navigate to="/newsroom/appointments" replace />;
  if (visible("settings")) return <Navigate to="/newsroom/settings" replace />;
  return <Navigate to="/login" replace />;
}
function StoriesByRole() {
  const s = getSession();
  if (!s) return <Navigate to="/login" replace />;
  return (
    <RequireMenu id="stories">
      <StoryManagement />
    </RequireMenu>
  );
}
function SettingsByRole() {
  const s = getSession();
  if (s?.user.role === "DOCTOR")
    return (
      <>
        <DoctorSettings />
        <PasskeySettingsTools />
      </>
    );
  return s ? (
    <>
      <ReaderSettings />
      <SelfAvatarTools />
      <PasskeySettingsTools />
    </>
  ) : (
    <Navigate to="/login" replace />
  );
}
export default function App() {
  return (
    <>
      <SessionControl />
      <OrganizationRouteGuard />
      <AuthenticatedHeader />
      <Routes>
        <Route path="/" element={<HomeBySession />} />
        <Route path="/stories/:slug" element={<ArticleDetail />} />
        <Route path="/registration/:slug" element={<PublicRegistration />} />
        <Route path="/login" element={<Login />} />
        <Route path="/newsroom/photos" element={<RequireAuth><MyPhotos /></RequireAuth>} />
        <Route
          path="/newsroom"
          element={
            <RequireAuth>
              <NewsroomByRole />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/stories"
          element={
            <RequireAuth>
              <StoriesByRole />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/people"
          element={
            <RequireAuth>
              <CooperationPeople />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/registrations"
          element={
            <RequireAuth>
              <RegistrationManagement />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/health-services"
          element={
            <RequireAuth>
              <AudienceHealthServices />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/appointments"
          element={
            <RequireAuth>
              <AudienceAppointments />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/doctor/appointments"
          element={
            <RequireAuth roles={["DOCTOR"]}>
              <DoctorAppointments />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/stories/:id/preview"
          element={
            <RequireAuth>
              <ArticleDetail preview />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/settings"
          element={
            <RequireAuth>
              <SettingsByRole />
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/users"
          element={
            <RequireAuth>
              <RequireMenu id="people">
                <AccountManagement />
                <AdminAvatarTools />
                <DepartmentSidebarNav />
              </RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/departments"
          element={
            <RequireAuth>
              <RequireMenu id="settings_organizations">
                <DepartmentManagement />
                <DepartmentSidebarLayout />
                <OrgChartLinkForOrganizationPage />
              </RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/org-chart"
          element={
            <RequireAuth>
              <RequireMenu id="settings_org_chart">
                <OrgStructureNormalized />
                <OrgChartSidebarLayout />
                <CategoryLinkForOrgChartPage />
              </RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/areas"
          element={
            <RequireAuth>
              <RequireMenu id="settings_areas"><AreaManagement /></RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/categories"
          element={
            <RequireAuth>
              <RequireMenu id="settings_categories"><NewsCategoryManagement /></RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/jingsi"
          element={
            <RequireAuth>
              <RequireMenu id="settings_jingsi"><JingSiManagement /></RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/languages"
          element={
            <RequireAuth>
              <RequireMenu id="settings_languages"><LanguageMappingManagement /></RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/roles"
          element={
            <RequireAuth>
              <RequireMenu id="settings_roles"><RoleManagement /></RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/health/events"
          element={
            <RequireAuth>
              <RequireMenu id="health_events"><HealthEventsAdmin /></RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/health/appointments"
          element={
            <RequireAuth>
              <RequireMenu id="appointments"><HealthAppointmentsAdmin /></RequireMenu>
            </RequireAuth>
          }
        />
        <Route
          path="/newsroom/health/doctors"
          element={
            <RequireAuth>
              <RequireMenu id="doctors"><HealthDoctorsAdmin /></RequireMenu>
            </RequireAuth>
          }
        />
      </Routes>
      <StoryComposer />
    </>
  );
}
