import React, { useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Lightning, Crosshair, Info } from "@phosphor-icons/react";
import { dataApi } from "../services/api";
import { useGeolocation } from "../hooks/useGeolocation";
import { Button, Input } from "../components/ui";
import { LoadingState } from "../components/ui/states";
import { apiError } from "../api/client";

export default function WhatNow() {
  const geo = useGeolocation();
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async (coords, locationName) => {
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        lat: coords?.lat, lng: coords?.lng, location: locationName,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      const res = await dataApi.whatNow(payload);
      setResult(res);
    } catch (err) {
      toast.error(apiError(err, "Couldn't fetch suggestions"));
    } finally {
      setLoading(false);
    }
  };

  const useLocation = () => {
    if (geo.coords) return run(geo.coords);
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => run({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error("Location denied. Enter a place manually.")
    );
  };

  const useManual = async (e) => {
    e.preventDefault();
    if (!manual.trim()) return;
    try {
      const g = await dataApi.geocode(manual.trim());
      run({ lat: g.lat, lng: g.lng }, manual.trim());
    } catch (err) {
      toast.error(apiError(err, "Location not found"));
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-ochre/15 text-ochre"><Lightning size={22} weight="fill" /></div>
        <h1 className="text-3xl font-extrabold text-ink">What can I do right now?</h1>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft"><Info size={15} /> Uses your location, the current time and live weather to suggest realistic options.</p>

      <div className="card mt-6 space-y-3 p-6">
        <Button onClick={useLocation} className="w-full" disabled={loading} data-testid="whatnow-use-location">
          <Crosshair size={18} weight="bold" /> Use my location
        </Button>
        <div className="flex items-center gap-3 text-xs text-ink-faint"><span className="h-px flex-1 bg-border" /> or a specific place <span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={useManual} className="flex gap-2">
          <Input placeholder="e.g. Barcelona" value={manual} onChange={(e) => setManual(e.target.value)} data-testid="whatnow-manual" />
          <Button type="submit" variant="secondary" disabled={loading}>Go</Button>
        </form>
      </div>

      {loading && <LoadingState label="COCO is reading the moment…" />}

      {result && (
        <div className="mt-6 space-y-3" data-testid="whatnow-results">
          <p className="text-sm text-ink-faint">Right now in <b className="text-ink">{result.context.location}</b> · {result.context.weather} · {result.context.time}</p>
          {result.suggestions.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-ink">{s.title}</h3>
                <span className="chip text-xs capitalize">{s.category}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">{s.why}</p>
              {s.tip && <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs text-ink-soft">💡 {s.tip}</p>}
              {s.duration && <p className="mt-2 text-xs text-ink-faint">Approx. {s.duration}</p>}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
