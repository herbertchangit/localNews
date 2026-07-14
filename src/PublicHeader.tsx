import { ReactNode, useEffect, useRef, useState } from "react";
import { LogOut, Menu, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

type HeaderSession = { user: { name: string } };

function readHeaderSession(): HeaderSession | null {
  try { return JSON.parse(localStorage.getItem("ln_session") || "null"); }
  catch { return null; }
}

const defaultJingSiMessage = "不断地付出就是在造福，面对人事就是在修慧，若能福慧双具，就是慧命增长。";

export default function PublicHeader({ children, className = "" }: { children?: ReactNode; className?: string }) {
  const location = useLocation();
  const session = readHeaderSession();
  const tickerRef = useRef<HTMLDivElement>(null);
  const [tickerHidden, setTickerHidden] = useState(false);
  const [jingSiMessage, setJingSiMessage] = useState(defaultJingSiMessage);
  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/jingsi/current", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((message) => { if (active && message?.content) setJingSiMessage(message.content); })
      .catch(() => undefined);
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener("localnews:jingsi-updated", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("localnews:jingsi-updated", load); };
  }, []);
  useEffect(() => {
    const update = () => setTickerHidden((tickerRef.current?.getBoundingClientRect().bottom ?? 1) <= 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  const logout = () => { localStorage.removeItem("ln_session"); window.location.assign("/"); };
  return <><div className="ticker jingSiTicker" ref={tickerRef}><b>JingSi (靜思語)</b><span>{jingSiMessage}</span></div><div className={`publicHeaderSticky${tickerHidden ? " tickerHidden" : ""}`}><header className={`publicSiteHeader ${className}`.trim()}>
    <Link to="/" className="brand"><span>LN</span><div>LOCAL NEWS<small>THE CITY, CLEARLY</small></div></Link>
    <div className="headerJingSiMarquee" aria-hidden={!tickerHidden}><div className="headerJingSiTrack"><b>JingSi (靜思語)</b><span>{jingSiMessage}</span></div></div>
    {children}
    <div className="actions headerActions"><button className="headerSearch" aria-label="Search"><Search /></button>{session ? <><Link className="headerUserName" to="/newsroom" title={`Open ${session.user.name}'s workspace`}>{session.user.name}</Link><button className="headerLogout" onClick={logout}><LogOut />Logout</button></> : <Link className="studio headerLogin" to="/login" state={{ from: location.pathname }}>Login</Link>}<button className="mobile headerMenu" aria-label="Menu"><Menu /></button></div>
  </header></div></>;
}
