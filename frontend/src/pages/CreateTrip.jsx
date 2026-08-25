import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Sparkle, ArrowLeft } from "@phosphor-icons/react";
import { Button, Input, Select, Textarea } from "../components/ui";
import { tripsApi } from "../services/api";
import { apiError } from "../api/client";
import { CURRENCIES, INTEREST_OPTIONS, TRAVEL_STYLES, PACES } from "../utils";
import { cn } from "../utils";

export default function CreateTrip() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", destination: "", start_date: "", end_date: "",
    travelers: 1, budget: "", currency: "USD",
    travel_style: "Balanced", pace: "Moderate", dietary: "", accessibility: "",
    food_pref: "", accommodation_pref: "Hotel", walking_level: "Moderate", luxury_level: "Mid", vibe: "Balanced",
  });
  const [interests, setInterests] = useState([]);
  const [touristLocal, setTouristLocal] = useState(50);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoGen, setAutoGen] = useState(true);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleInterest = (i) => setInterests((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.destination.trim()) return setError("Where are you going?");
    if (!form.start_date || !form.end_date) return setError("Pick your travel dates");
    if (form.end_date < form.start_date) return setError("End date must be after start date");
    setLoading(true);
    try {
      const payload = {
        title: form.title.trim() || undefined,
        destination: form.destination.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        travelers: Number(form.travelers) || 1,
        budget: form.budget ? Number(form.budget) : undefined,
        currency: form.currency,
        travel_style: form.travel_style,
        interests,
        dietary: form.dietary || undefined,
        accessibility: form.accessibility || undefined,
        pace: form.pace,
        food_pref: form.food_pref || undefined,
        accommodation_pref: form.accommodation_pref || undefined,
        walking_level: form.walking_level?.toLowerCase(),
        luxury_level: form.luxury_level === "Mid" ? "mid" : form.luxury_level?.toLowerCase(),
        tourist_vs_local: touristLocal,
        vibe: form.vibe,
      };
      const trip = await tripsApi.create(payload);
      qc.invalidateQueries({ queryKey: ["trips"] });
      if (autoGen) {
        toast.loading("COCO is planning your trip…", { id: "gen" });
        try {
          await tripsApi.generate(trip.id);
          toast.success("Itinerary ready!", { id: "gen" });
        } catch (err) {
          toast.error(apiError(err, "Created trip, but AI generation failed."), { id: "gen" });
        }
      } else {
        toast.success("Trip created!");
      }
      navigate(`/app/trips/${trip.id}`);
    } catch (err) {
      setError(apiError(err));
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate(-1)} className="btn-ghost mb-4" data-testid="create-back"><ArrowLeft size={18} /> Back</button>
      <h1 className="text-3xl font-extrabold text-ink">Plan a new trip</h1>
      <p className="mt-2 text-ink-soft">Give COCO the essentials. Everything except destination and dates is optional.</p>

      <form onSubmit={submit} className="mt-8 space-y-6" data-testid="create-trip-form">
        <div className="card space-y-4 p-6">
          <Input id="destination" label="Destination *" placeholder="e.g. Lisbon, Portugal" value={form.destination} onChange={set("destination")} required data-testid="trip-destination" />
          <Input label="Trip name (optional)" placeholder="Summer in Portugal" value={form.title} onChange={set("title")} data-testid="trip-name" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start date *" type="date" value={form.start_date} onChange={set("start_date")} required data-testid="trip-start" />
            <Input label="End date *" type="date" value={form.end_date} onChange={set("end_date")} required data-testid="trip-end" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Travelers" type="number" min="1" max="50" value={form.travelers} onChange={set("travelers")} data-testid="trip-travelers" />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Budget" type="number" min="0" placeholder="1500" value={form.budget} onChange={set("budget")} data-testid="trip-budget" />
              <Select label="Currency" value={form.currency} onChange={set("currency")} data-testid="trip-currency">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
        </div>

        <div className="card space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Travel style" value={form.travel_style} onChange={set("travel_style")} data-testid="trip-style">
              {TRAVEL_STYLES.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Pace" value={form.pace} onChange={set("pace")} data-testid="trip-pace">
              {PACES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          <div>
            <p className="label">Interests</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((i) => (
                <button type="button" key={i} onClick={() => toggleInterest(i)} className={cn("chip", interests.includes(i) && "chip-active")} data-testid={`interest-${i.toLowerCase()}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Dietary preferences" placeholder="Vegetarian, halal…" value={form.dietary} onChange={set("dietary")} data-testid="trip-dietary" />
            <Input label="Accessibility needs" placeholder="Step-free access…" value={form.accessibility} onChange={set("accessibility")} data-testid="trip-accessibility" />
          </div>
        </div>

        <div className="card space-y-4 p-6">
          <h3 className="font-bold text-ink">Personalize it</h3>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Accommodation" value={form.accommodation_pref} onChange={set("accommodation_pref")} data-testid="trip-accommodation">
              {["Hotel", "Boutique", "Apartment", "Guesthouse", "Hostel"].map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Comfort level" value={form.luxury_level} onChange={set("luxury_level")} data-testid="trip-luxury">
              {["Budget", "Mid", "Luxury"].map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Walking tolerance" value={form.walking_level} onChange={set("walking_level")} data-testid="trip-walking">
              {["Low", "Moderate", "High"].map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select label="Vibe" value={form.vibe} onChange={set("vibe")} data-testid="trip-vibe">
              {["Balanced", "Relaxed", "Romantic", "Adventure", "Foodie", "Party", "Culture"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          <Input label="Food preference" placeholder="Street food, fine dining, vegan…" value={form.food_pref} onChange={set("food_pref")} data-testid="trip-food" />
          <div>
            <div className="flex justify-between label"><span>Traveller style</span><span className="text-ink-faint">{touristLocal < 40 ? "Tourist classics" : touristLocal > 60 ? "Like a local" : "A bit of both"}</span></div>
            <input type="range" min="0" max="100" value={touristLocal} onChange={(e) => setTouristLocal(Number(e.target.value))} className="w-full accent-brand" data-testid="trip-tourist-local" />
            <div className="flex justify-between text-xs text-ink-faint"><span>Popular sights</span><span>Hidden & local</span></div>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-ink">
          <input type="checkbox" checked={autoGen} onChange={(e) => setAutoGen(e.target.checked)} className="h-4 w-4 rounded border-border text-brand focus:ring-brand" data-testid="trip-autogen" />
          Let COCO generate the itinerary automatically
        </label>

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" data-testid="create-error">{error}</p>}

        <motion.div whileTap={{ scale: 0.99 }}>
          <Button type="submit" className="w-full py-3 text-base" disabled={loading} data-testid="create-submit">
            <Sparkle size={20} weight="fill" /> {loading ? "Creating…" : autoGen ? "Create & generate" : "Create trip"}
          </Button>
        </motion.div>
      </form>
    </div>
  );
}
