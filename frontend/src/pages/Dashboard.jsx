import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, MapPin, CalendarBlank, Users, Suitcase, Sparkle } from "@phosphor-icons/react";
import { tripsApi } from "../services/api";
import { LoadingState, ErrorState, EmptyState, Skeleton } from "../components/ui/states";
import { Badge, Button } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { dateRange, tripDays } from "../utils/format";
import DestinationBanner from "../components/DestinationBanner";

const STATUS_COLORS = { planning: "#C8890F", planned: "#2F9E68", active: "#4A6E82", completed: "#8A8F87" };

function TripCard({ trip, index }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link to={`/app/trips/${trip.id}`} className="card block overflow-hidden p-0 transition-transform hover:-translate-y-1 hover:shadow-lift" data-testid={`trip-card-${trip.id}`}>
        <DestinationBanner name={trip.destination} height="8rem" label={false}>
          <div className="absolute right-3 top-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold capitalize shadow-sm" style={{ color: STATUS_COLORS[trip.status] || "#4B5563" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[trip.status] || "#8A8F87" }} />
              {trip.status}
            </span>
          </div>
        </DestinationBanner>
        <div className="p-4">
          <h3 className="truncate text-lg font-bold text-ink">{trip.title}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
            <MapPin size={15} /> <span className="truncate">{trip.destination}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-faint">
            <span className="flex items-center gap-1"><CalendarBlank size={14} /> {dateRange(trip.start_date, trip.end_date)}</span>
            <span className="flex items-center gap-1"><Users size={14} /> {trip.travelers}</span>
            <span>{tripDays(trip.start_date, trip.end_date)} days</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["trips"], queryFn: () => tripsApi.list() });

  const trips = data?.trips || [];

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Welcome back</p>
          <h1 className="text-3xl font-extrabold text-ink">{user?.name?.split(" ")[0] || "Explorer"}'s trips</h1>
        </div>
        <Button onClick={() => navigate("/app/create")} className="hidden sm:inline-flex" data-testid="dashboard-create-trip">
          <Plus size={18} weight="bold" /> New trip
        </Button>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : isError ? (
          <ErrorState message="Couldn't load your trips." onRetry={refetch} />
        ) : trips.length === 0 ? (
          <EmptyState
            icon={Suitcase}
            title="No trips yet"
            description="Create your first trip and let COCO draft a smart, editable itinerary in seconds."
            action={<Button onClick={() => navigate("/app/create")} data-testid="empty-create-trip"><Sparkle size={18} weight="fill" /> Plan my first trip</Button>}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((t, i) => <TripCard key={t.id} trip={t} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}
