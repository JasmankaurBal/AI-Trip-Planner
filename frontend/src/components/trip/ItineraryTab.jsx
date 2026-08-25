import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, PencilSimple, Trash, ArrowUp, ArrowDown, Clock, MapPin, CurrencyDollar, ArrowsClockwise, CaretDown,
} from "@phosphor-icons/react";
import { activitiesApi, tripsApi } from "../../services/api";
import { Button, Input, Select, Textarea, Modal, Badge } from "../ui";
import { EmptyState, LoadingState } from "../ui/states";
import { CATEGORY_COLORS } from "../../utils";
import { minutesLabel } from "../../utils/format";
import { money } from "../../utils/format";
import { apiError } from "../../api/client";
import AICommandBar from "./AICommandBar";

const CATEGORIES = Object.keys(CATEGORY_COLORS);
const EMPTY = { day_index: 0, title: "", description: "", location: "", start_time: "", duration_minutes: 60, estimated_cost: 0, category: "other", transport: "none", notes: "" };

function ActivityForm({ initial, days, onSave, onClose }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="space-y-4">
      <Input label="Title" value={f.title} onChange={set("title")} required data-testid="activity-title" />
      <Textarea label="Description" value={f.description} onChange={set("description")} data-testid="activity-desc" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Location" value={f.location} onChange={set("location")} data-testid="activity-location" />
        <Select label="Day" value={f.day_index} onChange={(e) => setF({ ...f, day_index: Number(e.target.value) })} data-testid="activity-day">
          {Array.from({ length: days }).map((_, i) => <option key={i} value={i}>Day {i + 1}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Start" type="time" value={f.start_time} onChange={set("start_time")} data-testid="activity-time" />
        <Input label="Mins" type="number" min="0" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: Number(e.target.value) })} data-testid="activity-duration" />
        <Input label="Cost" type="number" min="0" value={f.estimated_cost} onChange={(e) => setF({ ...f, estimated_cost: Number(e.target.value) })} data-testid="activity-cost" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Category" value={f.category} onChange={set("category")} data-testid="activity-category">
          {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
        </Select>
        <Input label="Transport" value={f.transport} onChange={set("transport")} data-testid="activity-transport" />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        <Button type="submit" className="flex-1" data-testid="activity-save">Save</Button>
      </div>
    </form>
  );
}

export default function ItineraryTab({ trip, days }) {
  const qc = useQueryClient();
  const tripId = trip.id;
  const [modal, setModal] = useState(null); // {mode, activity}
  const [openDays, setOpenDays] = useState({ 0: true });
  const [regenerating, setRegenerating] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["activities", tripId], queryFn: () => activitiesApi.list(tripId) });
  const activities = data?.activities || [];

  const byDay = useMemo(() => {
    const m = {};
    for (let i = 0; i < days; i++) m[i] = [];
    activities.forEach((a) => { (m[a.day_index] = m[a.day_index] || []).push(a); });
    return m;
  }, [activities, days]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["activities", tripId] });
    qc.invalidateQueries({ queryKey: ["budget", tripId] });
  };

  const save = async (f) => {
    try {
      if (modal.activity?.id) await activitiesApi.update(tripId, modal.activity.id, f);
      else await activitiesApi.create(tripId, f);
      invalidate();
      setModal(null);
      toast.success("Saved");
    } catch (err) { toast.error(apiError(err)); }
  };

  const del = async (id) => { await activitiesApi.remove(tripId, id); invalidate(); toast.success("Removed"); };

  const move = async (dayIdx, index, dir) => {
    const list = [...byDay[dayIdx]];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    await activitiesApi.reorder(tripId, { day_index: dayIdx, ordered_ids: list.map((a) => a.id) });
    qc.invalidateQueries({ queryKey: ["activities", tripId] });
  };

  const regenerate = async () => {
    setRegenerating(true);
    toast.loading("Regenerating itinerary…", { id: "regen" });
    try {
      await tripsApi.generate(tripId);
      invalidate();
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      toast.success("Itinerary regenerated!", { id: "regen" });
    } catch (err) { toast.error(apiError(err, "Regeneration failed"), { id: "regen" }); }
    finally { setRegenerating(false); }
  };

  if (isLoading) return <LoadingState label="Loading itinerary…" />;

  return (
    <div>
      <AICommandBar tripId={tripId} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{activities.length} activities across {days} days</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={regenerate} disabled={regenerating} data-testid="regenerate-itinerary">
            <ArrowsClockwise size={16} weight="bold" className={regenerating ? "animate-spin" : ""} /> Regenerate
          </Button>
          <Button onClick={() => setModal({ mode: "create", activity: { day_index: 0 } })} data-testid="add-activity"><Plus size={16} weight="bold" /> Add</Button>
        </div>
      </div>

      {activities.length === 0 ? (
        <EmptyState icon={MapPin} title="No activities yet" description="Regenerate with COCO or add your own activities." action={<Button onClick={regenerate} disabled={regenerating}>Generate with COCO</Button>} />
      ) : (
        <div className="space-y-3">
          {Object.keys(byDay).map((d) => {
            const dayIdx = Number(d);
            const list = byDay[dayIdx];
            const open = openDays[dayIdx];
            const dayCost = list.reduce((s, a) => s + (a.estimated_cost || 0), 0);
            return (
              <div key={d} className="card overflow-hidden p-0" data-testid={`day-${dayIdx}`}>
                <button onClick={() => setOpenDays((o) => ({ ...o, [dayIdx]: !o[dayIdx] }))} className="flex w-full items-center justify-between px-5 py-4 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-white">{dayIdx + 1}</span>
                    <div className="text-left">
                      <p className="font-bold text-ink">Day {dayIdx + 1}</p>
                      <p className="text-xs text-ink-faint">{list.length} activities · {money(dayCost, trip.currency)}</p>
                    </div>
                  </div>
                  <CaretDown size={18} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="space-y-2 border-t border-border p-3">
                        {list.length === 0 && <p className="px-2 py-3 text-sm text-ink-faint">No activities this day.</p>}
                        {list.map((a, i) => (
                          <div key={a.id} className="flex gap-3 rounded-xl border border-border p-3" data-testid="activity-item">
                            <div className="flex flex-col items-center gap-1 pt-1">
                              <button onClick={() => move(dayIdx, i, -1)} disabled={i === 0} className="text-ink-faint hover:text-brand disabled:opacity-30"><ArrowUp size={14} /></button>
                              <button onClick={() => move(dayIdx, i, 1)} disabled={i === list.length - 1} className="text-ink-faint hover:text-brand disabled:opacity-30"><ArrowDown size={14} /></button>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-semibold text-ink">{a.title}</h4>
                                <Badge color={CATEGORY_COLORS[a.category]}>{a.category}</Badge>
                              </div>
                              {a.description && <p className="mt-0.5 text-sm text-ink-soft">{a.description}</p>}
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-faint">
                                {a.start_time && <span className="flex items-center gap-1"><Clock size={12} /> {a.start_time}</span>}
                                {a.duration_minutes ? <span>{minutesLabel(a.duration_minutes)}</span> : null}
                                {a.location && <span className="flex items-center gap-1"><MapPin size={12} /> {a.location}</span>}
                                {a.estimated_cost ? <span className="flex items-center gap-1"><CurrencyDollar size={12} /> {money(a.estimated_cost, trip.currency)}</span> : null}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <button onClick={() => setModal({ mode: "edit", activity: a })} className="rounded-lg p-1.5 text-ink-faint hover:bg-muted hover:text-ink" data-testid="edit-activity"><PencilSimple size={16} /></button>
                              <button onClick={() => del(a.id)} className="rounded-lg p-1.5 text-ink-faint hover:bg-danger/10 hover:text-danger" data-testid="delete-activity"><Trash size={16} /></button>
                            </div>
                          </div>
                        ))}
                        <Button variant="ghost" onClick={() => setModal({ mode: "create", activity: { day_index: dayIdx } })} className="w-full justify-center"><Plus size={16} /> Add to day {dayIdx + 1}</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.activity?.id ? "Edit activity" : "Add activity"} testId="activity-modal">
        {modal && <ActivityForm initial={modal.activity} days={days} onSave={save} onClose={() => setModal(null)} />}
      </Modal>
    </div>
  );
}
