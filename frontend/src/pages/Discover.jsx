import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, Info } from "@phosphor-icons/react";
import { dataApi } from "../services/api";
import { DISCOVERY_CATEGORIES } from "../utils";
import { LoadingState, ErrorState, Skeleton } from "../components/ui/states";
import { Badge } from "../components/ui";
import DestinationBanner from "../components/DestinationBanner";
import { cn } from "../utils";

export default function Discover() {
  const [category, setCategory] = useState("trending");
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["discovery", category],
    queryFn: () => dataApi.discovery(category),
  });
  const destinations = data?.destinations || [];

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-ink">Discover destinations</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
        <Info size={15} /> Suggestions are AI-generated estimates — verify details before booking.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {DISCOVERY_CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={cn("chip capitalize", category === c && "chip-active")} data-testid={`discover-cat-${c.replace(/\s/g, "-")}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {isLoading || isFetching ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : isError ? (
          <ErrorState message="Discovery is temporarily unavailable." onRetry={refetch} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((d, i) => (
              <motion.div key={d.name + i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card overflow-hidden p-0" data-testid="discovery-card">
                <DestinationBanner name={d.name} height="9rem" label={false}>
                  <div className="absolute right-2 top-2"><span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-coco shadow-sm">AI estimate</span></div>
                </DestinationBanner>
                <div className="p-4">
                  <h3 className="text-lg font-bold text-ink">{d.name}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{d.description}</p>
                  {d.best_season && <p className="mt-2 text-xs text-ink-faint">Best season: {d.best_season}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(d.tags || []).slice(0, 3).map((t) => <span key={t} className="chip text-xs capitalize">{t}</span>)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
