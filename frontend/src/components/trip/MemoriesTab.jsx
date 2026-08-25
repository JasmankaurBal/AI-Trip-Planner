import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Camera, MapPin } from "@phosphor-icons/react";
import { tripsApi } from "../../services/api";
import { Button, Input, Textarea, Modal, Card } from "../ui";
import { EmptyState, LoadingState } from "../ui/states";
import { fmtDate } from "../../utils/format";
import { apiError } from "../../api/client";

export default function MemoriesTab({ trip }) {
  const qc = useQueryClient();
  const tripId = trip.id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", note: "", favorite_places: "" });
  const { data, isLoading } = useQuery({ queryKey: ["memories", tripId], queryFn: () => tripsApi.memories(tripId) });
  const memories = data?.memories || [];

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await tripsApi.addMemory(tripId, {
        title: form.title.trim(),
        note: form.note,
        favorite_places: form.favorite_places ? form.favorite_places.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      qc.invalidateQueries({ queryKey: ["memories", tripId] });
      setOpen(false);
      setForm({ title: "", note: "", favorite_places: "" });
      toast.success("Memory saved");
    } catch (err) { toast.error(apiError(err)); }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-ink">Trip memories</h3>
          <p className="text-sm text-ink-faint">Capture highlights and build a story of your journey.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="add-memory"><Plus size={16} weight="bold" /> Add</Button>
      </div>

      {memories.length === 0 ? (
        <EmptyState icon={Camera} title="No memories captured yet" description="Add notes and favourite places as your trip unfolds." />
      ) : (
        <div className="relative space-y-4 border-l-2 border-border pl-6">
          {memories.map((m) => (
            <div key={m.id} className="relative" data-testid="memory-item">
              <span className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-surface bg-brand" />
              <Card>
                <p className="text-xs text-ink-faint">{fmtDate(m.created_at, "MMM d, yyyy · h:mm a")}</p>
                <h4 className="mt-1 font-bold text-ink">{m.title}</h4>
                {m.note && <p className="mt-1 text-sm text-ink-soft">{m.note}</p>}
                {m.favorite_places?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.favorite_places.map((p) => <span key={p} className="chip text-xs"><MapPin size={12} /> {p}</span>)}
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add memory" testId="memory-modal">
        <form onSubmit={save} className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required data-testid="memory-title" />
          <Textarea label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} data-testid="memory-note" />
          <Input label="Favourite places (comma separated)" value={form.favorite_places} onChange={(e) => setForm({ ...form, favorite_places: e.target.value })} data-testid="memory-places" />
          <Button type="submit" className="w-full" data-testid="memory-save">Save memory</Button>
        </form>
      </Modal>
    </div>
  );
}
