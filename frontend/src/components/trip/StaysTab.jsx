import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Star, MapPin, Check, House, Info, CaretRight } from "@phosphor-icons/react";
import { tripsApi } from "../../services/api";
import { Button, Badge } from "../ui";
import { EmptyState, LoadingState, ErrorState } from "../ui/states";
import DestinationBanner from "../DestinationBanner";
import { cn } from "../../utils";

const STYLES = [
  { key: "any", label: "All" },
  { key: "hotel", label: "Hotels" },
  { key: "boutique", label: "Boutique" },
  { key: "apartment", label: "Apartments" },
  { key: "guesthouse", label: "Guesthouses" },
  { key: "hostel", label: "Hostels" },
];

function scoreColor(s) {
  if (s >= 80) return "#2F9E68";
  if (s >= 65) return "#C8890F";
  return "#8A8F87";
}

export default function StaysTab({ trip }) {
  const qc = useQueryClient();
  const tripId = trip.id;
  const [style, setStyle] = useState("any");
  const local = (trip.tourist_vs_local ?? 50) >= 60;
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["hotels", tripId, style],
    queryFn: () => tripsApi.hotels(tripId, style),
  });

  const select = async (h) => {
    await tripsApi.selectHotel(tripId, h);
    qc.invalidateQueries({ queryKey: ["hotels", tripId] });
    qc.invalidateQueries({ queryKey: ["trip", tripId] });
    toast.success(`${h.name} set as your stay`);
  };

  const hotels = data?.hotels || [];
  const selected = trip.selected_hotel;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-ink">Where to stay</h3>
          <p className="text-sm text-ink-soft">Ranked by an AI Match Score for <b>your</b> trip. Real listings from OpenStreetMap.</p>
        </div>
      </div>

      {local && (
        <div className="flex items-start gap-2 rounded-xl border border-coco/30 bg-coco/5 p-3 text-sm text-ink-soft" data-testid="stay-local">
          <House size={18} className="mt-0.5 shrink-0 text-coco" />
          <span><b className="text-coco">Stay Like a Local</b> — your profile leans local, so COCO boosts stays in residential neighbourhoods with more authentic character over tourist-hub hotels.</span>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STYLES.map((s) => (
          <button key={s.key} onClick={() => setStyle(s.key)} className={cn("chip shrink-0", style === s.key && "chip-active")} data-testid={`stay-style-${s.key}`}>{s.label}</button>
        ))}
      </div>

      {!data?.pricing_available && (
        <p className="flex items-center gap-1.5 text-xs text-ink-faint"><Info size={13} /> Live prices & booking require a connected accommodation provider (HOTEL_API_KEY). COCO never invents prices.</p>
      )}

      {isLoading || isFetching ? <LoadingState label="Finding great stays…" /> : isError ? <ErrorState onRetry={refetch} /> :
        data?.degraded ? <EmptyState icon={House} title="Accommodation data unavailable" description={data.message} /> :
        hotels.length === 0 ? <EmptyState icon={House} title="No stays found nearby" description="Try a different style or widen the area." /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {hotels.map((h) => {
            const isSel = selected?.id === h.id;
            return (
              <div key={h.id} className={cn("card overflow-hidden p-0", isSel && "ring-2 ring-brand")} data-testid="hotel-card">
                <div className="relative h-28">
                  {h.image ? <img src={h.image} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} /> : <DestinationBanner name={h.name} height="100%" label={false} />}
                  <div className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-xs font-extrabold shadow" style={{ color: scoreColor(h.match_score) }} data-testid="match-score">
                    {h.match_score}<span className="text-ink-faint">/100</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-ink">{h.name}</h4>
                    {h.stars ? <span className="flex items-center gap-0.5 text-xs text-ochre">{h.stars}<Star size={12} weight="fill" /></span> : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-faint">
                    <span className="capitalize">{h.style}</span>
                    {h.distance_km != null && <span className="flex items-center gap-1"><MapPin size={12} /> {h.distance_km} km from your plans</span>}
                  </div>
                  {h.amenities?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {h.amenities.slice(0, 4).map((a) => <span key={a} className="chip text-[11px] capitalize"><Check size={11} /> {a}</span>)}
                    </div>
                  )}
                  {h.match_reasons?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {h.match_reasons.slice(0, 2).map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-ink-soft"><Check size={13} className="mt-0.5 shrink-0 text-success" /> {r}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant={isSel ? "secondary" : "primary"} onClick={() => select(h)} className="flex-1 !py-2 text-sm" data-testid="select-hotel">
                      {isSel ? "Selected ✓" : "Select stay"}
                    </Button>
                    {h.website && <a href={h.website} target="_blank" rel="noreferrer" className="btn-ghost !px-2" title="Website"><CaretRight size={16} /></a>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
