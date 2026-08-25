import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagicWand, MapTrifold, Wallet, ChatCircleDots, Compass, Lightning, ArrowRight, MagnifyingGlass, X, MapPin,
} from "@phosphor-icons/react";
import { Logo, CocoAvatar } from "../components/Logo";
import ChatPanel from "../components/chat/ChatPanel";
import { exploreApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  { icon: MagicWand, title: "AI itineraries that make sense", body: "COCO builds day-by-day plans with real places, sensible timing and minimal backtracking — then you edit freely." },
  { icon: MapTrifold, title: "Everything on one map", body: "See your whole trip, nearby restaurants, hospitals and hidden gems on an interactive OpenStreetMap." },
  { icon: Wallet, title: "Budgets & shared expenses", body: "Track spending by category, split costs with travel buddies and settle up with the fewest transactions." },
  { icon: ChatCircleDots, title: "A companion that knows your trip", body: "Ask COCO to make a day cheaper or swap an activity — it understands your itinerary in context." },
  { icon: Compass, title: "Discover with intent", body: "Explore destinations by mood: adventure, food, nature, hidden gems — clearly labelled AI suggestions, no fake reviews." },
  { icon: Lightning, title: "\u201cWhat can I do right now?\u201d", body: "Given your location, time and weather, COCO suggests realistic things to do this very moment." },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const appHref = user ? "/app" : "/register";
  const [q, setQ] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const { suggestions } = await exploreApi.suggest(q.trim());
        setSuggestions(suggestions || []);
        setShowSug(true);
        setActiveIdx(-1);
      } catch { setSuggestions([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setShowSug(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (dest) => navigate(`/explore?dest=${encodeURIComponent(dest)}`);

  const search = (e) => {
    e.preventDefault();
    if (activeIdx >= 0 && suggestions[activeIdx]) return go(suggestions[activeIdx].label);
    if (!q.trim()) return navigate("/explore");
    go(q.trim());
  };

  const onKeyDown = (e) => {
    if (!showSug || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo size={30} />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link to="/explore" className="btn-ghost" data-testid="landing-explore">Explore</Link>
          <button onClick={() => setChatOpen(true)} className="btn-ghost" data-testid="landing-chat"><ChatCircleDots size={18} weight="bold" /> <span className="hidden sm:inline">Ask COCO</span></button>
          <Link to="/login" className="btn-ghost hidden sm:inline-flex" data-testid="landing-login">Sign in</Link>
          <Link to={appHref} className="btn-primary" data-testid="landing-get-started">Get started</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 md:grid-cols-2 md:py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="chip chip-active">Your calm AI travel companion</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight text-ink md:text-6xl">
            Plan the whole trip,<br />not just the flight.
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink-soft">
            COCO turns a destination and a few preferences into a real, editable itinerary — with maps, budgets, weather and a companion that actually understands your plan.
          </p>
          <form onSubmit={search} className="relative mt-6 flex max-w-md gap-2" data-testid="landing-search-form" ref={boxRef}>
            <div className="relative flex-1">
              <MagnifyingGlass size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => suggestions.length && setShowSug(true)}
                onKeyDown={onKeyDown}
                placeholder="Where do you want to go? e.g. Lisbon"
                className="field pl-11"
                autoComplete="off"
                data-testid="landing-search-input"
              />
              {showSug && suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-lift" data-testid="landing-suggestions">
                  {suggestions.map((s, i) => (
                    <li key={s.label + i}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => go(s.label)}
                        className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm ${i === activeIdx ? "bg-brand-soft text-brand" : "text-ink hover:bg-muted"}`}
                        data-testid={`landing-suggestion-${i}`}
                      >
                        <MapPin size={15} className="shrink-0 text-ink-faint" />
                        <span className="truncate">{s.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="submit" className="btn-primary" data-testid="landing-search-btn">Search</button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-faint">
            <span>Popular:</span>
            {["Tokyo", "Paris", "Bali", "Rome"].map((c) => (
              <button key={c} onClick={() => navigate(`/explore?dest=${encodeURIComponent(c)}`)} className="chip" data-testid={`landing-popular-${c.toLowerCase()}`}>{c}</button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={appHref} className="btn-primary px-6 py-3 text-base" data-testid="hero-cta">
              Plan a trip <ArrowRight size={18} weight="bold" />
            </Link>
            <Link to="/login" className="btn-secondary px-6 py-3 text-base">I have an account</Link>
          </div>
          <p className="mt-4 text-sm text-ink-faint">No credit card. Free to start.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="relative">
          <img
            src="https://images.unsplash.com/reserve/91JuTaUSKaMh2yjB1C4A_IMG_9284.jpg?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
            alt="A traveler walking toward mountains at sunset"
            className="aspect-[4/5] w-full rounded-2xl object-cover shadow-lift"
            loading="eager"
          />
          <div className="absolute -bottom-4 -left-4 hidden max-w-[220px] rounded-2xl border border-border bg-surface p-4 shadow-card sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">COCO says</p>
            <p className="mt-1 text-sm text-ink">"Day 2 looks packed — want me to add a slower afternoon?"</p>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="max-w-xl text-3xl font-bold text-ink">Everything you need, engineered to actually work.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card p-6"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon size={24} weight="bold" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="card overflow-hidden bg-brand p-8 text-white md:p-12">
          <h2 className="text-3xl font-bold">Three steps to a plan you'll actually use</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              ["01", "Tell COCO where & when", "Destination, dates, budget and a few interests. Skip anything you like."],
              ["02", "Generate & refine", "COCO drafts a structured itinerary. Edit, reorder, regenerate or chat to adjust."],
              ["03", "Travel with confidence", "Maps, weather, budgets and a Travel Mode built for the road."],
            ].map(([n, t, d]) => (
              <div key={n}>
                <p className="font-mono text-3xl font-bold text-white/50">{n}</p>
                <h3 className="mt-2 text-lg font-bold">{t}</h3>
                <p className="mt-1 text-sm text-white/80">{d}</p>
              </div>
            ))}
          </div>
          <Link to={appHref} className="btn mt-10 bg-white px-6 py-3 text-brand hover:bg-white/90" data-testid="how-cta">
            Start planning <ArrowRight size={18} weight="bold" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Logo size={24} />
          <p className="text-sm text-ink-faint">Built as a calm, human travel companion. Maps © OpenStreetMap contributors.</p>
        </div>
      </footer>

      {/* COCO chat drawer */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div className="fixed inset-0 z-50 flex justify-end bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChatOpen(false)}>
            <motion.div className="flex h-full w-full max-w-md flex-col bg-surface" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2"><CocoAvatar size={28} /><h3 className="font-bold text-ink">Ask COCO</h3></div>
                <button onClick={() => setChatOpen(false)} className="rounded-full p-1.5 text-ink-soft hover:bg-muted" data-testid="landing-chat-close"><X size={20} /></button>
              </div>
              <ChatPanel guest className="flex-1 overflow-hidden" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
