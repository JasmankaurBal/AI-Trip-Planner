import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  House, Compass, MapPin, ChatCircleDots, Lightning, FolderLock, User, Plus, SignOut, Suitcase,
} from "@phosphor-icons/react";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { initials } from "../utils/format";
import { cn } from "../utils";

const NAV = [
  { to: "/app", label: "Trips", icon: House, end: true },
  { to: "/app/discover", label: "Discover", icon: Compass },
  { to: "/app/nearby", label: "Nearby", icon: MapPin },
  { to: "/app/chat", label: "COCO Chat", icon: ChatCircleDots },
  { to: "/app/what-now", label: "What now?", icon: Lightning },
  { to: "/app/documents", label: "Documents", icon: FolderLock },
];

const BOTTOM = [
  { to: "/app", label: "Trips", icon: House, end: true },
  { to: "/app/discover", label: "Discover", icon: Compass },
  { to: "/app/create", label: "Create", icon: Plus, primary: true },
  { to: "/app/chat", label: "Chat", icon: ChatCircleDots },
  { to: "/app/profile", label: "Profile", icon: User },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface md:flex">
        <div className="px-5 py-5">
          <NavLink to="/app" data-testid="sidebar-logo">
            <Logo size={30} />
          </NavLink>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`nav-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-muted hover:text-ink"
                )
              }
            >
              <Icon size={20} weight="bold" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <button onClick={() => navigate("/app/create")} className="btn-primary w-full" data-testid="sidebar-create-trip">
            <Plus size={18} weight="bold" /> New trip
          </button>
        </div>
        <div className="flex items-center gap-3 border-t border-border p-4">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-brand-soft text-sm font-bold text-brand">
            {user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
            <p className="truncate text-xs text-ink-faint">{user?.email}</p>
          </div>
          <button onClick={doLogout} className="rounded-lg p-2 text-ink-soft hover:bg-muted" title="Log out" data-testid="logout-button">
            <SignOut size={18} />
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md md:hidden">
        <NavLink to="/app"><Logo size={26} /></NavLink>
        <NavLink to="/app/profile" className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-brand-soft text-xs font-bold text-brand" data-testid="mobile-profile">
          {user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : initials(user?.name)}
        </NavLink>
      </header>

      {/* Main */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-10" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
        {BOTTOM.map(({ to, label, icon: Icon, primary, end }) =>
          primary ? (
            <NavLink key={to} to={to} className="flex flex-1 flex-col items-center justify-center py-2" data-testid={`bottomnav-${label.toLowerCase()}`}>
              <span className="grid h-11 w-11 -translate-y-1 place-items-center rounded-full bg-brand text-white shadow-lift">
                <Icon size={24} weight="bold" />
              </span>
            </NavLink>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`bottomnav-${label.toLowerCase()}`}
              className={({ isActive }) =>
                cn("flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold", isActive ? "text-brand" : "text-ink-faint")
              }
            >
              <Icon size={22} weight={location.pathname === to ? "fill" : "regular"} />
              {label}
            </NavLink>
          )
        )}
      </nav>
    </div>
  );
}
