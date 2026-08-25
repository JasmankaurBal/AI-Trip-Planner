import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash, Sparkle, Backpack } from "@phosphor-icons/react";
import { packingApi } from "../../services/api";
import { Button, Input } from "../ui";
import { EmptyState, LoadingState } from "../ui/states";
import { apiError } from "../../api/client";

export default function PackingTab({ trip }) {
  const qc = useQueryClient();
  const tripId = trip.id;
  const [name, setName] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["packing", tripId], queryFn: () => packingApi.list(tripId) });
  const items = data?.items || [];

  const grouped = items.reduce((acc, it) => { (acc[it.category] = acc[it.category] || []).push(it); return acc; }, {});
  const packed = items.filter((i) => i.checked).length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["packing", tripId] });

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await packingApi.add(tripId, { name: name.trim(), category: "custom" });
    setName("");
    invalidate();
  };
  const toggle = async (it) => { await packingApi.update(tripId, it.id, { checked: !it.checked }); invalidate(); };
  const del = async (id) => { await packingApi.remove(tripId, id); invalidate(); };
  const generate = async () => {
    try { await packingApi.generate(tripId); invalidate(); toast.success("Packing list generated"); }
    catch (err) { toast.error(apiError(err)); }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-ink">Packing list</h3>
          {items.length > 0 && <p className="text-sm text-ink-faint">{packed} / {items.length} packed</p>}
        </div>
        <Button variant="secondary" onClick={generate} data-testid="generate-packing"><Sparkle size={16} weight="fill" /> Auto-generate</Button>
      </div>

      <form onSubmit={add} className="flex gap-2">
        <Input placeholder="Add an item…" value={name} onChange={(e) => setName(e.target.value)} data-testid="packing-input" />
        <Button type="submit" data-testid="packing-add"><Plus size={16} weight="bold" /></Button>
      </form>

      {items.length === 0 ? (
        <EmptyState icon={Backpack} title="Nothing packed yet" description="Auto-generate a smart list based on your trip, or add items manually." />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat} className="card p-4">
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-faint">{cat}</h4>
              <div className="space-y-1">
                {list.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-muted/50" data-testid="packing-item">
                    <input type="checkbox" checked={it.checked} onChange={() => toggle(it)} className="h-5 w-5 rounded border-border text-brand focus:ring-brand" data-testid="packing-toggle" />
                    <span className={`flex-1 text-sm ${it.checked ? "text-ink-faint line-through" : "text-ink"}`}>{it.name}</span>
                    <button onClick={() => del(it.id)} className="text-ink-faint hover:text-danger"><Trash size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
