import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CalendarBlank, Users, MapPin, Trash, ChatCircleDots, NavigationArrow, X,
  ListChecks, MapTrifold, Wallet, Receipt, Backpack, UsersThree, Sparkle, Camera, CalendarCheck, Bed, Airplane, ShareNetwork,
} from "@phosphor-icons/react";
import { tripsApi, activitiesApi } from "../services/api";
import { LoadingState, ErrorState } from "../components/ui/states";
import { Button, Modal } from "../components/ui";
import { dateRange, tripDays } from "../utils/format";
import ItineraryTab from "../components/trip/ItineraryTab";
import CalendarTab from "../components/trip/CalendarTab";
import StaysTab from "../components/trip/StaysTab";
import FlightsTab from "../components/trip/FlightsTab";
import BudgetTab from "../components/trip/BudgetTab";
import ExpensesTab from "../components/trip/ExpensesTab";
import PackingTab from "../components/trip/PackingTab";
import CollaboratorsTab from "../components/trip/CollaboratorsTab";
import OptimizerTab from "../components/trip/OptimizerTab";
import MemoriesTab from "../components/trip/MemoriesTab";
import WeatherStrip from "../components/trip/WeatherStrip";
import TripMap from "../components/map/TripMap";
import ChatPanel from "../components/chat/ChatPanel";
import DestinationBanner from "../components/DestinationBanner";

const TABS = [
  { key: "itinerary", label: "Itinerary", icon: ListChecks },
  { key: "calendar", label: "Calendar", icon: CalendarCheck },
  { key: "map", label: "Map", icon: MapTrifold },
  { key: "stays", label: "Stays", icon: Bed },
  { key: "flights", label: "Flights", icon: Airplane },
  { key: "budget", label: "Budget", icon: Wallet },
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "packing", label: "Packing", icon: Backpack },
  { key: "team", label: "Team", icon: UsersThree },
  { key: "optimizer", label: "Optimizer", icon: Sparkle },
  { key: "memories", label: "Memories", icon: Camera },
];

function MapTab({ trip }) {
  const { data } = useQuery({ queryKey: ["activities", trip.id], queryFn: () => activitiesApi.list(trip.id) });
  const points = (data?.activities || []).map((a, i) => ({ ...a, label: i + 1 }));
  return (
    <div>
      <p className="mb-3 text-sm text-ink-soft">{points.filter((p) => p.lat).length} mapped stops. Tap a pin for details.</p>
      <TripMap points={points} height={520} />
    </div>
  );
}

export default function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("itinerary");
  const [chatOpen, setChatOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const { data: trip, isLoading, isError, refetch } = useQuery({ queryKey: ["trip", id], queryFn: () => tripsApi.get(id) });

  if (isLoading) return <LoadingState label="Loading trip…" />;
  if (isError || !trip) return <ErrorState message="Couldn't load this trip." onRetry={refetch} />;

  const days = tripDays(trip.start_date, trip.end_date);

  const doShare = async () => {
    const t = toast.loading("Creating share link…");
    try {
      const { token } = await tripsApi.share(id);
      toast.success("Share link ready", { id: t });
      window.open(`/share/${token}`, "_blank");
    } catch {
      toast.error("Couldn't create share link", { id: t });
    }
  };

  const doDelete = async () => {
    try {
      await tripsApi.remove(id);
      qc.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip deleted");
      navigate("/app");
    } catch { toast.error("Could not delete trip"); }
  };

  return (
    <div>
      <button onClick={() => navigate("/app")} className="btn-ghost mb-3" data-testid="trip-back"><ArrowLeft size={18} /> All trips</button>

      {/* Header */}
      <div className="card overflow-hidden p-0">
        <div className="relative h-36 sm:h-44">
          <DestinationBanner name={trip.destination} height="100%" label={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 text-white">
            <h1 className="text-2xl font-extrabold sm:text-3xl" data-testid="trip-title">{trip.title}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
              <span className="flex items-center gap-1"><MapPin size={14} /> {trip.destination}</span>
              <span className="flex items-center gap-1"><CalendarBlank size={14} /> {dateRange(trip.start_date, trip.end_date)}</span>
              <span className="flex items-center gap-1"><Users size={14} /> {trip.travelers} · {days} days</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <Button as={Link} to={`/app/trips/${id}/travel`} variant="secondary" data-testid="travel-mode-btn"><NavigationArrow size={16} weight="bold" /> Travel mode</Button>
          <Button variant="secondary" onClick={doShare} data-testid="share-trip-btn"><ShareNetwork size={16} weight="bold" /> Share / PDF</Button>
          <Button variant="ghost" onClick={() => setChatOpen(true)} data-testid="open-trip-chat"><ChatCircleDots size={16} /> Ask COCO</Button>
          <div className="flex-1" />
          <button onClick={() => setDelOpen(true)} className="rounded-lg p-2 text-ink-faint hover:bg-danger/10 hover:text-danger" data-testid="delete-trip"><Trash size={18} /></button>
        </div>
      </div>

      {trip.summary && <p className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand" data-testid="trip-summary">{trip.summary}</p>}

      <div className="mt-4"><WeatherStrip destination={trip.destination} /></div>

      {/* Tabs */}
      <div className="sticky top-14 z-10 -mx-4 mt-5 flex gap-1 overflow-x-auto border-b border-border bg-canvas px-4 py-2 md:top-0 md:mx-0 md:px-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            data-testid={`tab-${key}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${tab === key ? "bg-brand text-white" : "text-ink-soft hover:bg-muted"}`}
          >
            <Icon size={16} weight={tab === key ? "fill" : "regular"} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-5 pb-4">
        {tab === "itinerary" && <ItineraryTab trip={trip} days={days} />}
        {tab === "calendar" && <CalendarTab trip={trip} />}
        {tab === "map" && <MapTab trip={trip} />}
        {tab === "stays" && <StaysTab trip={trip} />}
        {tab === "flights" && <FlightsTab trip={trip} />}
        {tab === "budget" && <BudgetTab trip={trip} />}
        {tab === "expenses" && <ExpensesTab trip={trip} />}
        {tab === "packing" && <PackingTab trip={trip} />}
        {tab === "team" && <CollaboratorsTab trip={trip} />}
        {tab === "optimizer" && <OptimizerTab trip={trip} />}
        {tab === "memories" && <MemoriesTab trip={trip} />}
      </div>

      {/* Floating chat button (desktop) */}
      <button onClick={() => setChatOpen(true)} className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-coco text-white shadow-lift md:bottom-8" data-testid="fab-chat" aria-label="Ask COCO">
        <ChatCircleDots size={26} weight="fill" />
      </button>

      {/* Chat drawer */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div className="fixed inset-0 z-50 flex justify-end bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChatOpen(false)}>
            <motion.div
              className="flex h-full w-full max-w-md flex-col bg-surface"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="font-bold text-ink">COCO · {trip.destination}</h3>
                <button onClick={() => setChatOpen(false)} className="rounded-full p-1.5 text-ink-soft hover:bg-muted"><X size={20} /></button>
              </div>
              <ChatPanel tripId={id} className="flex-1 overflow-hidden" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete trip?" testId="delete-modal">
        <p className="text-ink-soft">This permanently removes the trip, its itinerary, expenses and packing list. This can't be undone.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" onClick={() => setDelOpen(false)} className="flex-1">Cancel</Button>
          <Button variant="danger" onClick={doDelete} className="flex-1" data-testid="confirm-delete">Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
