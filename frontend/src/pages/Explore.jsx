import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass, Sparkle, MapPin, Star, Bed, ForkKnife, Buildings, Tree, ShoppingBag,
  ChatCircleDots, X, ArrowRight, Info, CaretDown, House,
} from "@phosphor-icons/react";
import { exploreApi } from "../services/api";
import { Logo, CocoAvatar } from "../components/Logo";
import { Button, Input, Badge } from "../components/ui";
import { LoadingState, EmptyState } from "../components/ui/states";
import DestinationBanner from "../components/DestinationBanner";
import ChatPanel from "../components/chat/ChatPanel";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";
import { apiError } from "../api/client";
import { cn } from "../utils";

const THINGS = [
  { key: "attractions", label: "Attractions", icon: Buildings },
  { key: "food", label: "Food", icon: ForkKnife },
  { key: "nature", label: "Nature", icon: Tree },
  { key: "shopping", label: "Shopping", icon: ShoppingBag },
];

export default function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [dest, setDest] = useState("");
  const [thingCat, setThingCat] = useState("attractions");
  const [chatOpen, setChatOpen] = useState(false);
  const [view, setView] = useState("things"); // things | stays | plan

  const things = useMutation({ mutationFn: ({ d, c }) => exploreApi.thingsToDo(d, c) });
  const stays = useMutation({ mutationFn: (d) => exploreApi.hotels({ destination: d }) });
  const gen = useMutation({ mutationFn: (payload) => exploreApi.generate(payload) });
  const [params] = useSearchParams();

  useEffect(() => {
    const d = params.get("dest");
    if (d) {
      setQ(d);
      setDest(d);
      setView("things");
      things.mutate({ d, c: "attractions" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setDest(q.trim());
    setView("things");
    things.mutate({ d: q.trim(), c: thingCat });
  };

  const pickThing = (c) => { setThingCat(c); things.mutate({ d: dest, c }); };
  const openStays = () => { setView("stays"); if (!stays.data) stays.mutate(dest); };
  const planSample = () => {
    setView("plan");
    const today = new Date();
    const start = new Date(today.getTime() + 14 * 864e5).toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 16 * 864e5).toISOString().slice(0, 10);
    gen.mutate({ destination: dest, start_date: start, end_date: end, travelers: 2, interests: ["food", "culture"] });
  };

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/90 px-5 py-3 backdrop-blur">
        <Link to="/"><Logo size={28} /></Link>
        <nav className="flex items-center gap-2">
          {user ? <Link to="/app" className="btn-primary">My trips</Link> : (
            <>
              <Link to="/login" className="btn-ghost">Sign in</Link>
              <Link to="/register" className="btn-primary" data-testid="explore-signup">Sign up free</Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-5 pt-8">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-extrabold text-ink md:text-5xl">
          Explore anywhere. No account needed.
        </motion.h1>
        <p className="mt-3 max-w-xl text-lg text-ink-soft">Search a destination to see real things to do and places to stay, ask COCO anything, and generate a free sample itinerary.</p>

        <form onSubmit={search} className="mt-6 flex gap-2" data-testid="explore-search-form">
          <div className="relative flex-1">
            <MagnifyingGlass size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try 'Lisbon, Portugal' or 'Kyoto'" className="field pl-11" data-testid="explore-search-input" />
          </div>
          <Button type="submit" data-testid="explore-search-btn">Explore</Button>
        </form>
      </section>

      {dest && (
        <section className="mx-auto max-w-5xl px-5 pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-lg font-bold text-ink"><MapPin size={18} className="text-brand" /> {dest}</span>
            <div className="flex-1" />
            <div className="flex gap-2">
              <button onClick={() => { setView("things"); }} className={cn("chip", view === "things" && "chip-active")} data-testid="explore-tab-things">Things to do</button>
              <button onClick={openStays} className={cn("chip", view === "stays" && "chip-active")} data-testid="explore-tab-stays"><Bed size={14} /> Stays</button>
              <button onClick={planSample} className={cn("chip", view === "plan" && "chip-active")} data-testid="explore-tab-plan"><Sparkle size={14} weight="fill" /> Plan it</button>
            </div>
          </div>

          {/* THINGS */}
          {view === "things" && (
            <div>
              <div className="mb-3 flex gap-2 overflow-x-auto">
                {THINGS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => pickThing(key)} className={cn("chip shrink-0", thingCat === key && "chip-active")} data-testid={`explore-thing-${key}`}>
                    <Icon size={14} weight="bold" /> {label}
                  </button>
                ))}
              </div>
              {things.isPending ? <LoadingState label="Finding places…" /> :
                things.data?.degraded ? <EmptyState icon={MapPin} title="Places data unavailable" description={things.data.message} /> :
                (things.data?.places || []).length === 0 ? <EmptyState icon={MapPin} title="Search a destination" description="Nothing to show yet." /> : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {things.data.places.map((p) => (
                    <div key={p.id} className="card p-4" data-testid="explore-place">
                      <h3 className="font-bold text-ink">{p.name}</h3>
                      {p.address && <p className="mt-0.5 text-sm text-ink-soft">{p.address}</p>}
                      {p.cuisine && <p className="text-xs capitalize text-ink-faint">{p.cuisine.replace(/;/g, ", ")}</p>}
                      <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand">On map <ArrowRight size={13} /></a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STAYS */}
          {view === "stays" && (
            <div>
              {stays.isPending ? <LoadingState label="Finding stays…" /> :
                stays.data?.degraded ? <EmptyState icon={House} title="Accommodation unavailable" description={stays.data.message} /> :
                (stays.data?.hotels || []).length === 0 ? <EmptyState icon={House} title="No stays found" /> : (
                <>
                  {!stays.data?.pricing_available && <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-faint"><Info size={13} /> Real listings from OpenStreetMap. Live prices need a connected provider — COCO never invents them.</p>}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stays.data.hotels.slice(0, 12).map((h) => (
                      <div key={h.id} className="card overflow-hidden p-0" data-testid="explore-hotel">
                        <div className="relative h-24"><DestinationBanner name={h.name} height="100%" label={false} />
                          <div className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-extrabold text-brand">{h.match_score}/100</div>
                        </div>
                        <div className="p-3">
                          <h3 className="font-bold text-ink">{h.name}</h3>
                          <p className="text-xs capitalize text-ink-faint">{h.style}{h.stars ? ` · ${h.stars}★` : ""}</p>
                          {h.match_reasons?.[0] && <p className="mt-1 text-xs text-ink-soft">{h.match_reasons[0]}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* PLAN (guest generate) */}
          {view === "plan" && (
            <div>
              {gen.isPending ? <LoadingState label="COCO is drafting a sample itinerary…" /> :
                gen.isError ? <EmptyState icon={Sparkle} title="Couldn't generate" description={apiError(gen.error)} action={<Button onClick={planSample}>Retry</Button>} /> :
                gen.data ? (
                <div>
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
                    <Sparkle size={18} weight="fill" className="mt-0.5 shrink-0" /> {gen.data.summary}
                  </div>
                  <div className="space-y-3">
                    {gen.data.days.map((d) => (
                      <div key={d.day_index} className="card p-4" data-testid="guest-day">
                        <h3 className="font-bold text-ink">Day {d.day_index + 1} · {d.title}</h3>
                        <div className="mt-2 space-y-2">
                          {d.activities.map((a, i) => (
                            <div key={i} className="flex items-start gap-2 border-l-2 border-border pl-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink">{a.start_time && <span className="text-brand">{a.start_time} · </span>}{a.title}</p>
                                {a.description && <p className="text-xs text-ink-soft">{a.description}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-brand/30 bg-surface p-5 text-center">
                    <p className="font-bold text-ink">Love it? Save this trip to edit, map, budget & more.</p>
                    <Button onClick={() => navigate(user ? "/app/create" : "/register")} className="mt-3" data-testid="guest-save-cta">
                      {user ? "Create & customize" : "Create free account to save"} <ArrowRight size={16} weight="bold" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}

      {/* Floating public chat */}
      <button onClick={() => setChatOpen(true)} className="fixed bottom-6 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-coco text-white shadow-lift" data-testid="explore-chat-fab"><ChatCircleDots size={26} weight="fill" /></button>
      <AnimatePresence>
        {chatOpen && (
          <motion.div className="fixed inset-0 z-50 flex justify-end bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChatOpen(false)}>
            <motion.div className="flex h-full w-full max-w-md flex-col bg-surface" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2"><CocoAvatar size={28} /><h3 className="font-bold text-ink">Ask COCO{dest ? ` · ${dest}` : ""}</h3></div>
                <button onClick={() => setChatOpen(false)} className="rounded-full p-1.5 text-ink-soft hover:bg-muted"><X size={20} /></button>
              </div>
              <ChatPanel guest context={dest ? { destination: dest } : null} className="flex-1 overflow-hidden" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
