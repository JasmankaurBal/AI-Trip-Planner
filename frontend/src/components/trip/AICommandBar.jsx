import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Sparkle, PaperPlaneRight, Sun, CurrencyDollar, Crown, PersonSimpleWalk, MapPinLine, Heart, Shuffle } from "@phosphor-icons/react";
import { tripsApi } from "../../services/api";
import { apiError } from "../../api/client";

const QUICK = [
  { icon: CurrencyDollar, label: "Make cheaper", cmd: "Make this trip noticeably cheaper without ruining the experience" },
  { icon: Crown, label: "Upgrade", cmd: "Give me a more premium, upgraded version of this trip" },
  { icon: PersonSimpleWalk, label: "Less walking", cmd: "Reduce the amount of walking and group nearby activities" },
  { icon: MapPinLine, label: "More local", cmd: "Add more authentic local experiences and hidden gems, fewer tourist traps" },
  { icon: Sun, label: "Rainy day", cmd: "It might rain tomorrow — swap outdoor activities for good indoor alternatives" },
  { icon: Heart, label: "More romantic", cmd: "Make this trip more romantic" },
  { icon: Shuffle, label: "Surprise me", cmd: "Surprise me: add one unexpected, delightful experience each day" },
];

export default function AICommandBar({ tripId }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (instruction) => {
    if (!instruction.trim() || busy) return;
    setBusy(true);
    toast.loading("COCO is reworking your plan…", { id: "aiedit" });
    try {
      const res = await tripsApi.aiEdit(tripId, instruction);
      qc.invalidateQueries({ queryKey: ["activities", tripId] });
      qc.invalidateQueries({ queryKey: ["budget", tripId] });
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      setInput("");
      toast.success(res.summary || "Itinerary updated!", { id: "aiedit", duration: 5000 });
    } catch (err) {
      toast.error(apiError(err, "Couldn't update the itinerary"), { id: "aiedit" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="card mb-4 border-coco/30 bg-coco/5 p-4" data-testid="ai-command-bar">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-coco"><Sparkle size={16} weight="fill" /> Ask COCO to change your plan</div>
      <form onSubmit={(e) => { e.preventDefault(); run(input); }} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. I'm tired today, make day 2 relaxed and cheaper"
          className="field flex-1"
          disabled={busy}
          data-testid="ai-command-input"
        />
        <button type="submit" className="btn-primary !px-3.5" disabled={busy || !input.trim()} data-testid="ai-command-send" aria-label="Send">
          <PaperPlaneRight size={18} weight="fill" />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK.map(({ icon: Icon, label, cmd }) => (
          <button key={label} onClick={() => run(cmd)} disabled={busy} className="chip hover:chip-active disabled:opacity-50" data-testid={`ai-quick-${label.toLowerCase().replace(/\s/g, "-")}`}>
            <Icon size={14} weight="bold" /> {label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
