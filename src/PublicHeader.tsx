import { ReactNode } from "react";
import { LogOut, Menu, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

type HeaderSession = { user: { name: string } };

function readHeaderSession(): HeaderSession | null {
  try { return JSON.parse(localStorage.getItem("ln_session") || "null"); }
  catch { return null; }
}

export default function PublicHeader({ tickerLabel, tickerText, children, className = "" }: { tickerLabel: string; tickerText: string; children?: ReactNode; className?: string }) {
  const location = useLocation();
  const session = readHeaderSession();
  const logout = () => { localStorage.removeItem("ln_session"); window.location.assign("/"); };
  return <><div className="ticker"><b>{tickerLabel}</b><span>{tickerText}</span></div><div className="publicHeaderSticky"><header className={`publicSiteHeader ${className}`.trim()}>
    <Link to="/" className="brand"><span>LN</span><div>LOCAL NEWS<small>THE CITY, CLEARLY</small></div></Link>
    {children}
    <div className="actions headerActions"><button className="headerSearch" aria-label="Search"><Search /></button>{session ? <><Link className="headerUserName" to="/newsroom" title={`Open ${session.user.name}'s workspace`}>{session.user.name}</Link><button className="headerLogout" onClick={logout}><LogOut />Logout</button></> : <Link className="studio headerLogin" to="/login" state={{ from: location.pathname }}>Login</Link>}<button className="mobile headerMenu" aria-label="Menu"><Menu /></button></div>
  </header></div></>;
}
