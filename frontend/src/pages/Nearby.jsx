import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ForkKnife, Coffee, Buildings, Pill, FirstAid, ShieldCheck, Bus, ShoppingBag, MapPin, Crosshair, Phone, Globe,
} from "@phosphor-icons/react";
import { dataApi } from "../services/api";
import { useGeolocation } from "../hooks/useGeolocation";
import { Button, Input } from "../components/ui";
import { LoadingState, ErrorState, EmptyState } from "../components/ui/states";
import TripMap from "../components/map/TripMap";
import { apiError } from "../api/client";
import { cn } from "../utils";

const CATS = [
  { key: "restaurants", label: "Food", icon: ForkKnife },
  { key: "cafes", label: "Cafés", icon: Coffee },
  { key: "attractions", label: "Attractions", icon: Buildings },
  { key: "pharmacies", label: "Pharmacies", icon: Pill },
  { key: "hospitals", label: "Hospitals", icon: FirstAid },
  { key: "police", label: "Police", icon: ShieldCheck },
  { key: "transport", label: "Transport", icon: Bus },
  { key: "shopping", label: "Shopping", icon: ShoppingBag },
];

export default function Nearby() {
  const geo = useGeolocation();
  const [category, setCategory] = useState("restaurants");
  const [manual, setManual] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["places", geo.coords?.lat, geo.coords?.lng, category],
    queryFn: () => dataApi.places({ lat: geo.coords.lat, lng: geo.coords.lng, category, radius: 3000 }),
    enabled: !!geo.coords,
  });

  const searchManual = async (e) => {
    e.preventDefault();
    if (!manual.trim()) return;
    try {
      const res = await dataApi.geocode(manual.trim());
      geo.setManual(res.lat, res.lng);
      toast.success(`Location set: ${res.name?.split(",")[0] || manual}`);
    } catch (err) {
      toast.error(apiError(err, "Location not found"));
    }
  };

  const places = data?.places || [];

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-ink">Nearby</h1>
      <p className="mt-1 text-ink-soft">Find real places around you using OpenStreetMap. We only use your location to search — it never leaves your device without asking.</p>

      {!geo.coords ? (
        <div className="card mt-6 flex flex-col items-center gap-4 p-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand"><Crosshair size={24} /></div>
          <div>
            <h3 className="text-lg font-bold text-ink">Where should we look?</h3>
            <p className="mt-1 text-sm text-ink-soft">Use your current location, or search a place manually.</p>
          </div>
          <Button onClick={geo.request} disabled={geo.status === "prompting"} data-testid="use-my-location">
            <Crosshair size={18} weight="bold" /> {geo.status === "prompting" ? "Locating…" : "Use my location"}
          </Button>
          {(geo.status === "denied" || geo.status === "error") && (
            <p className="text-sm text-warning">Location unavailable. Search manually below.</p>
          )}
          <form onSubmit={searchManual} className="flex w-full max-w-sm gap-2">
            <Input placeholder="e.g. Rome, Italy" value={manual} onChange={(e) => setManual(e.target.value)} data-testid="manual-location-input" />
            <Button type="submit" variant="secondary" data-testid="manual-location-search">Search</Button>
          </form>
        </div>
      ) : (
        <>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {CATS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setCategory(key)} className={cn("chip shrink-0", category === key && "chip-active")} data-testid={`nearby-cat-${key}`}>
                <Icon size={16} weight="bold" /> {label}
              </button>
            ))}
            <button onClick={() => geo.request()} className="chip shrink-0" title="Recenter"><Crosshair size={16} /></button>
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {isLoading || isFetching ? (
                <LoadingState label="Searching nearby…" />
              ) : isError ? (
                <ErrorState message="Couldn't fetch places." onRetry={refetch} />
              ) : places.length === 0 ? (
                <EmptyState icon={MapPin} title={data?.degraded ? "Map data unavailable" : "Nothing found nearby"} description={data?.degraded ? (data.message || "The map data provider is temporarily unreachable. Please try again shortly.") : "Try another category or widen your search."} />
              ) : (
                <div className="space-y-3" data-testid="nearby-results">
                  {places.map((p) => (
                    <div key={p.id} className="card flex items-start justify-between gap-3 p-4" data-testid="nearby-place">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-ink">{p.name}</h3>
                        {p.address && <p className="truncate text-sm text-ink-soft">{p.address}</p>}
                        {p.cuisine && <p className="text-xs capitalize text-ink-faint">{p.cuisine.replace(/;/g, ", ")}</p>}
                        {p.opening_hours && <p className="mt-1 text-xs text-ink-faint">🕑 {p.opening_hours}</p>}
                        <div className="mt-2 flex gap-3 text-xs">
                          {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-brand"><Phone size={13} /> Call</a>}
                          {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand"><Globe size={13} /> Website</a>}
                          <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand"><MapPin size={13} /> Map</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              <div className="sticky top-20">
                <TripMap points={places.map((p) => ({ ...p, category }))} center={[geo.coords.lat, geo.coords.lng]} height={480} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
