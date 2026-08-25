import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Printer, MapPin, CalendarBlank, Users, Bed, Clock, LinkSimple, WhatsappLogo, EnvelopeSimple } from "@phosphor-icons/react";
import { publicApi } from "../services/api";
import { Logo } from "../components/Logo";
import { LoadingState, ErrorState } from "../components/ui/states";
import { money, minutesLabel, dateRange, tripDays, fmtDate } from "../utils/format";
import { addDays, parseISO } from "date-fns";

export default function SharePlan() {
  const { token } = useParams();
  const { data: trip, isLoading, isError, refetch } = useQuery({ queryKey: ["public-trip", token], queryFn: () => publicApi.trip(token) });

  if (isLoading) return <LoadingState label="Loading trip…" />;
  if (isError || !trip) return <div className="mx-auto max-w-lg p-8"><ErrorState message="This shared trip link is invalid or was revoked." onRetry={refetch} /></div>;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `Check out my ${trip.destination} trip on COCO`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); }
    catch { toast.error("Couldn't copy — long-press the URL to copy."); }
  };
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}: ${shareUrl}`)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`Here's my travel plan: ${shareUrl}`)}`;

  const days = tripDays(trip.start_date, trip.end_date);
  const byDay = {};
  for (let i = 0; i < days; i++) byDay[i] = [];
  (trip.activities || []).forEach((a) => { (byDay[a.day_index] = byDay[a.day_index] || []).push(a); });
  const total = (trip.activities || []).reduce((s, a) => s + (a.estimated_cost || 0), 0) * (trip.travelers || 1);

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface px-5 py-3">
        <Logo size={26} />
        <div className="flex items-center gap-2">
          <button onClick={copyLink} className="btn-secondary !px-3" title="Copy link" data-testid="share-copy"><LinkSimple size={18} weight="bold" /> <span className="hidden sm:inline">Copy</span></button>
          <a href={waHref} target="_blank" rel="noreferrer" className="btn-secondary !px-3" title="Share on WhatsApp" data-testid="share-whatsapp"><WhatsappLogo size={18} weight="fill" /></a>
          <a href={mailHref} className="btn-secondary !px-3" title="Share via email" data-testid="share-email"><EnvelopeSimple size={18} weight="bold" /></a>
          <button onClick={() => window.print()} className="btn-primary" data-testid="print-button"><Printer size={18} weight="bold" /> <span className="hidden sm:inline">Print / PDF</span></button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0" data-testid="share-plan">
        <div className="mb-1 flex items-center gap-2 text-sm text-ink-faint"><Logo size={20} /> <span>Travel plan</span></div>
        <h1 className="text-3xl font-extrabold">{trip.title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
          <span className="flex items-center gap-1"><MapPin size={15} /> {trip.destination}</span>
          <span className="flex items-center gap-1"><CalendarBlank size={15} /> {dateRange(trip.start_date, trip.end_date)} · {days} days</span>
          <span className="flex items-center gap-1"><Users size={15} /> {trip.travelers} traveller(s)</span>
          {trip.budget ? <span>Budget {money(trip.budget, trip.currency)}</span> : null}
        </div>
        {trip.summary && <p className="mt-3 rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand print:bg-transparent print:px-0">{trip.summary}</p>}
        {trip.selected_hotel?.name && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft"><Bed size={15} /> Stay: <b className="text-ink">{trip.selected_hotel.name}</b></p>
        )}

        <div className="mt-6 space-y-5">
          {Object.keys(byDay).map((d) => {
            const idx = Number(d);
            const list = byDay[idx];
            const date = trip.start_date ? addDays(parseISO(trip.start_date), idx) : null;
            const dayCost = list.reduce((s, a) => s + (a.estimated_cost || 0), 0);
            return (
              <section key={d} className="break-inside-avoid">
                <div className="mb-2 flex items-center gap-3 border-b border-border pb-1">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">{idx + 1}</span>
                  <h2 className="text-lg font-bold">Day {idx + 1}{date ? ` · ${fmtDate(date, "EEE, MMM d")}` : ""}</h2>
                  <span className="ml-auto text-sm text-ink-faint">{money(dayCost, trip.currency)}</span>
                </div>
                {list.length === 0 ? <p className="text-sm text-ink-faint">Free day.</p> : (
                  <div className="space-y-2">
                    {list.map((a) => (
                      <div key={a.id} className="flex gap-3">
                        <div className="w-16 shrink-0 text-sm font-semibold text-brand">{a.start_time || "—"}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{a.title} <span className="text-xs font-normal capitalize text-ink-faint">· {a.category}</span></p>
                          {a.description && <p className="text-sm text-ink-soft">{a.description}</p>}
                          <p className="text-xs text-ink-faint">
                            {a.location && <span className="mr-2">{a.location}</span>}
                            {a.duration_minutes ? <span className="mr-2"><Clock size={11} className="inline" /> {minutesLabel(a.duration_minutes)}</span> : null}
                            {a.estimated_cost ? <span>{money(a.estimated_cost, trip.currency)}</span> : null}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-ink-faint">Estimated activities total</span>
          <span className="font-bold">{money(total, trip.currency)}</span>
        </div>
        <p className="mt-6 text-center text-xs text-ink-faint">Made with COCO · Maps © OpenStreetMap contributors</p>
      </div>
    </div>
  );
}
