import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  CalendarBlank, CookingPot, PersonSimpleWalk, CurrencyDollar, CarProfile, WarningCircle, Path, Clock, MapPin,
} from "@phosphor-icons/react";
import { tripsApi, activitiesApi } from "../../services/api";
import { Card, Badge, Button } from "../ui";
import { LoadingState } from "../ui/states";
import { CATEGORY_COLORS } from "../../utils";
import { money, minutesLabel, fmtDate, tripDays } from "../../utils/format";
import { addDays, parseISO } from "date-fns";
import AICommandBar from "./AICommandBar";
import { cn } from "../../utils";

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
      <Icon size={18} className="text-brand" />
      <div className="leading-tight">
        <p className="text-sm font-bold text-ink">{value}</p>
        <p className="text-[11px] text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

export default function CalendarTab({ trip }) {
  const qc = useQueryClient();
  const tripId = trip.id;
  const days = tripDays(trip.start_date, trip.end_date);
  const [day, setDay] = useState(0);

  const { data: actData } = useQuery({ queryKey: ["activities", tripId], queryFn: () => activitiesApi.list(tripId) });
  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["day-summary", tripId, day],
    queryFn: () => tripsApi.daySummary(tripId, day),
  });

  const dayActs = (actData?.activities || []).filter((a) => a.day_index === day);
  const dayDate = trip.start_date ? addDays(parseISO(trip.start_date), day) : null;

  const optimize = async () => {
    toast.loading("Optimizing route…", { id: "opt" });
    try {
      await tripsApi.optimizeRoute(tripId, day);
      qc.invalidateQueries({ queryKey: ["activities", tripId] });
      qc.invalidateQueries({ queryKey: ["day-summary", tripId, day] });
      toast.success("Route optimized to reduce backtracking", { id: "opt" });
    } catch { toast.error("Couldn't optimize", { id: "opt" }); }
  };

  return (
    <div className="space-y-4">
      {/* Day strip */}
      <div className="flex gap-2 overflow-x-auto pb-1" data-testid="calendar-daystrip">
        {Array.from({ length: days }).map((_, i) => {
          const d = trip.start_date ? addDays(parseISO(trip.start_date), i) : null;
          return (
            <button key={i} onClick={() => setDay(i)} className={cn("flex shrink-0 flex-col items-center rounded-xl border px-3 py-2", day === i ? "border-brand bg-brand text-white" : "border-border bg-surface text-ink-soft")} data-testid={`calendar-day-${i}`}>
              <span className="text-[11px] font-semibold uppercase">{d ? fmtDate(d, "EEE") : `D${i + 1}`}</span>
              <span className="text-lg font-extrabold leading-none">{d ? fmtDate(d, "d") : i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* What's cooking today */}
      <motion.div key={day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-ochre/30 bg-ochre/5" data-testid="whats-cooking">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-ochre/20 text-ochre"><CookingPot size={20} weight="fill" /></div>
            <div>
              <h3 className="font-bold text-ink">What's cooking on {dayDate ? fmtDate(dayDate, "EEEE, MMM d") : `Day ${day + 1}`}?</h3>
              <p className="text-sm text-ink-soft">{sumLoading ? "…" : summary?.headline}</p>
            </div>
          </div>
          {summary && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat icon={CurrencyDollar} label="Est. spend" value={money(summary.estimated_spend, summary.currency)} />
                <Stat icon={PersonSimpleWalk} label="Walking" value={`${summary.walking_km} km`} />
                <Stat icon={CarProfile} label="Travel time" value={minutesLabel(summary.total_travel_min) || "0m"} />
                <Stat icon={CalendarBlank} label="Activities" value={summary.activities_count} />
              </div>
              {summary.reservations?.length > 0 && (
                <p className="mt-3 text-sm text-ink-soft"><b>Reservations:</b> {summary.reservations.join(" · ")}</p>
              )}
              {summary.warnings?.map((w, i) => (
                <div key={i} className="mt-2 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-ink-soft" data-testid="day-warning">
                  <WarningCircle size={16} className="mt-0.5 shrink-0 text-warning" /> {w}
                </div>
              ))}
            </>
          )}
        </Card>
      </motion.div>

      <div className="flex items-center justify-between">
        <h4 className="font-bold text-ink">Schedule</h4>
        <Button variant="secondary" onClick={optimize} className="!py-2 text-sm" data-testid="optimize-route"><Path size={16} weight="bold" /> Optimize route</Button>
      </div>

      <div className="space-y-2">
        {dayActs.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-ink-faint">Nothing planned this day. Ask COCO below to fill it in.</p>}
        {dayActs.map((a) => (
          <div key={a.id} className="card flex items-start gap-3 p-3" data-testid="calendar-activity">
            <div className="w-14 shrink-0 text-center">
              <p className="text-sm font-bold text-brand">{a.start_time || "—"}</p>
              <p className="text-[11px] text-ink-faint">{minutesLabel(a.duration_minutes)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h5 className="font-semibold text-ink">{a.title}</h5>
                <Badge color={CATEGORY_COLORS[a.category]}>{a.category}</Badge>
              </div>
              {a.location && <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint"><MapPin size={12} /> {a.location}</p>}
            </div>
          </div>
        ))}
      </div>

      <AICommandBar tripId={tripId} />
    </div>
  );
}
