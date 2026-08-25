import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  X, Sun, Wallet, NavigationArrow, Warning, Phone, FirstAid, ShieldCheck, Pill, ChatCircleDots, MapPin, Clock,
} from "@phosphor-icons/react";
import { tripsApi, activitiesApi, dataApi } from "../services/api";
import { LoadingState } from "../components/ui/states";
import { Button, Modal } from "../components/ui";
import { CocoAvatar } from "../components/Logo";
import ChatPanel from "../components/chat/ChatPanel";
import WeatherStrip from "../components/trip/WeatherStrip";
import { useGeolocation } from "../hooks/useGeolocation";
import { money, minutesLabel } from "../utils/format";

export default function TravelMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const geo = useGeolocation();
  const [emergOpen, setEmergOpen] = useState(false);
  const [emerg, setEmerg] = useState(null);
  const [emergLoading, setEmergLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const { data: trip, isLoading } = useQuery({ queryKey: ["trip", id], queryFn: () => tripsApi.get(id) });
  const { data: actData } = useQuery({ queryKey: ["activities", id], queryFn: () => activitiesApi.list(id) });
  const { data: budget } = useQuery({ queryKey: ["budget", id], queryFn: () => tripsApi.budget(id) });

  if (isLoading || !trip) return <LoadingState label="Entering travel mode…" />;

  const activities = actData?.activities || [];
  const current = activities[0];
  const next = activities[1];

  const findEmergency = async () => {
    setEmergOpen(true);
    setEmergLoading(true);
    const run = async (coords) => {
      try {
        const res = await dataApi.emergency({ lat: coords.lat, lng: coords.lng, radius: 6000 });
        setEmerg(res);
      } catch { setEmerg({ error: true }); }
      finally { setEmergLoading(false); }
    };
    if (geo.coords) return run(geo.coords);
    if (!navigator.geolocation) { setEmergLoading(false); setEmerg({ error: true }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => run({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setEmergLoading(false); setEmerg({ noLocation: true }); }
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Travel mode</p>
          <h1 className="text-lg font-extrabold text-ink">{trip.destination}</h1>
        </div>
        <button onClick={() => navigate(`/app/trips/${id}`)} className="rounded-full p-2 text-ink-soft hover:bg-muted" data-testid="exit-travel-mode"><X size={24} /></button>
      </header>

      <div className="mx-auto max-w-xl space-y-4 p-4 pb-28">
        {/* Now */}
        <div className="rounded-2xl border-2 border-brand bg-brand-soft p-5" data-testid="travel-current">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">Right now</p>
          {current ? (
            <>
              <h2 className="mt-1 text-2xl font-extrabold text-ink">{current.title}</h2>
              {current.description && <p className="mt-1 text-base text-ink-soft">{current.description}</p>}
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink-soft">
                {current.start_time && <span className="flex items-center gap-1"><Clock size={16} /> {current.start_time}</span>}
                {current.duration_minutes ? <span>{minutesLabel(current.duration_minutes)}</span> : null}
                {current.location && <span className="flex items-center gap-1"><MapPin size={16} /> {current.location}</span>}
              </div>
              {current.lat && (
                <a href={`https://www.openstreetmap.org/?mlat=${current.lat}&mlon=${current.lng}#map=17/${current.lat}/${current.lng}`} target="_blank" rel="noreferrer" className="btn-primary mt-3 w-full">
                  <NavigationArrow size={18} weight="bold" /> Directions
                </a>
              )}
            </>
          ) : (
            <p className="mt-1 text-lg text-ink-soft">No activities scheduled. Enjoy the freedom!</p>
          )}
        </div>

        {/* Next */}
        {next && (
          <div className="rounded-2xl border border-border p-4" data-testid="travel-next">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Up next</p>
            <h3 className="mt-1 text-lg font-bold text-ink">{next.title}</h3>
            {next.start_time && <p className="text-sm text-ink-soft">{next.start_time} · {next.location}</p>}
          </div>
        )}

        <WeatherStrip destination={trip.destination} />

        {/* Budget snapshot */}
        {budget && (
          <div className="rounded-2xl border border-border p-4" data-testid="travel-budget">
            <div className="flex items-center gap-2"><Wallet size={18} className="text-brand" /><p className="font-bold text-ink">Budget</p></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-extrabold text-ink">{money(budget.total_spent, budget.currency)}</p><p className="text-xs text-ink-faint">Spent</p></div>
              <div><p className="text-lg font-extrabold" style={{ color: budget.remaining < 0 ? "#D6553F" : "#2F9E68" }}>{money(budget.remaining, budget.currency)}</p><p className="text-xs text-ink-faint">Left</p></div>
              <div><p className="text-lg font-extrabold text-ink">{money(budget.daily_average, budget.currency)}</p><p className="text-xs text-ink-faint">Per day</p></div>
            </div>
          </div>
        )}

        <Button variant="danger" onClick={findEmergency} className="w-full py-3.5 text-base" data-testid="emergency-button">
          <Warning size={20} weight="fill" /> Emergency help
        </Button>
      </div>

      {/* COCO button */}
      <button onClick={() => setChatOpen(true)} className="fixed bottom-6 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-coco text-white shadow-lift" data-testid="travel-chat"><ChatCircleDots size={26} weight="fill" /></button>

      {/* Chat */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2"><CocoAvatar size={30} /><h3 className="font-bold text-ink">COCO</h3></div>
            <button onClick={() => setChatOpen(false)} className="rounded-full p-2 text-ink-soft hover:bg-muted"><X size={24} /></button>
          </div>
          <ChatPanel tripId={id} className="flex-1 overflow-hidden" />
        </div>
      )}

      {/* Emergency modal */}
      <Modal open={emergOpen} onClose={() => setEmergOpen(false)} title="Emergency assistance" testId="emergency-modal">
        {emergLoading ? (
          <LoadingState label="Finding nearby help…" />
        ) : emerg?.noLocation ? (
          <p className="text-ink-soft">Location access is needed to find nearby help. Please enable location and try again.</p>
        ) : emerg?.error ? (
          <p className="text-ink-soft">Couldn't fetch nearby services. In an emergency, dial your local emergency number.</p>
        ) : emerg ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-danger/10 p-3">
              <p className="text-sm font-bold text-danger">Emergency numbers</p>
              <div className="mt-1 grid grid-cols-2 gap-1 text-sm text-ink">
                {Object.entries(emerg.hotlines?.common || {}).map(([k, v]) => (
                  <span key={k}><b>{v}</b> <span className="text-ink-faint">{k}</span></span>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-faint">{emerg.hotlines?.note}</p>
            </div>
            {[["hospitals", "Hospitals", FirstAid], ["police", "Police", ShieldCheck], ["pharmacies", "Pharmacies", Pill]].map(([key, label, Icon]) => (
              (emerg[key]?.length > 0) && (
                <div key={key}>
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink"><Icon size={16} /> {label}</p>
                  <div className="space-y-1">
                    {emerg[key].slice(0, 4).map((p) => (
                      <a key={p.id} href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                        <span className="truncate text-ink">{p.name}</span>
                        {p.phone ? <span className="flex items-center gap-1 text-brand"><Phone size={13} /> Call</span> : <MapPin size={14} className="text-ink-faint" />}
                      </a>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
