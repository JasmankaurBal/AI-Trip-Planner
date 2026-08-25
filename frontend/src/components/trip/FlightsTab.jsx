import React, { useState } from "react";
import toast from "react-hot-toast";
import { Airplane, Clock, ArrowRight, Money, Info, Lightning, Medal } from "@phosphor-icons/react";
import { tripsApi } from "../../services/api";
import { Button, Input, Card } from "../ui";
import { LoadingState } from "../ui/states";
import { money, minutesLabel } from "../../utils/format";
import { apiError } from "../../api/client";

function OfferCard({ tag, offer, icon: Icon, accent }) {
  if (!offer) return null;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2" style={{ color: accent }}><Icon size={18} weight="fill" /><span className="text-sm font-bold">{tag}</span></div>
      <p className="mt-2 text-xl font-extrabold text-ink">{money(offer.price, offer.currency)}</p>
      <p className="text-sm text-ink-soft">{offer.carrier} · {minutesLabel(offer.duration_min)} · {offer.stops === 0 ? "Direct" : `${offer.stops} stop(s)`}</p>
      {offer.deep_link && <a href={offer.deep_link} target="_blank" rel="noreferrer" className="btn-secondary mt-3 w-full !py-2 text-sm">View</a>}
    </Card>
  );
}

export default function FlightsTab({ trip }) {
  const [origin, setOrigin] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    if (!origin.trim()) return;
    setLoading(true);
    try {
      setData(await tripsApi.flights(trip.id, origin.trim()));
    } catch (err) {
      toast.error(apiError(err, "Flight search failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-ink">Flights to {trip.destination}</h3>
        <p className="text-sm text-ink-soft">Compare cheapest, fastest and best-overall — with honest trade-offs.</p>
      </div>
      <form onSubmit={search} className="flex gap-2">
        <Input placeholder="From (city or airport, e.g. London / LHR)" value={origin} onChange={(e) => setOrigin(e.target.value)} data-testid="flight-origin" />
        <Button type="submit" disabled={loading} data-testid="flight-search"><Airplane size={16} weight="bold" /> Search</Button>
      </form>

      {loading && <LoadingState label="Searching flights…" />}

      {data && !data.configured && (
        <Card className="flex items-start gap-3 border-warning/30 bg-warning/5" data-testid="flights-not-configured">
          <Info size={22} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="font-bold text-ink">Live flights not connected</p>
            <p className="mt-1 text-sm text-ink-soft">{data.message}</p>
            <p className="mt-2 text-xs text-ink-faint">Provider abstraction ready: set <code className="rounded bg-muted px-1">FLIGHT_API_KEY</code> (Amadeus/Duffel) to enable real prices, durations, baggage and booking.</p>
          </div>
        </Card>
      )}

      {data?.configured && data.ranked && (
        <div className="grid gap-4 sm:grid-cols-3">
          <OfferCard tag="Cheapest" offer={data.ranked.cheapest} icon={Money} accent="#2F9E68" />
          <OfferCard tag="Fastest" offer={data.ranked.fastest} icon={Lightning} accent="#C8890F" />
          <OfferCard tag="Best overall" offer={data.ranked.best} icon={Medal} accent="#4A6E82" />
        </div>
      )}
    </div>
  );
}
