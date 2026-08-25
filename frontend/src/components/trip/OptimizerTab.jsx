import React, { useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Sparkle, WarningCircle, CheckCircle, Info } from "@phosphor-icons/react";
import { tripsApi } from "../../services/api";
import { Button } from "../ui";
import { apiError } from "../../api/client";

const SEV = {
  high: { color: "#D6553F", icon: WarningCircle },
  medium: { color: "#C8890F", icon: WarningCircle },
  low: { color: "#4A6E82", icon: Info },
  info: { color: "#2F9E68", icon: CheckCircle },
  ok: { color: "#2F9E68", icon: CheckCircle },
};

export default function OptimizerTab({ trip }) {
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const res = await tripsApi.optimize(trip.id);
      setRecs(res.recommendations);
    } catch (err) { toast.error(apiError(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <h3 className="text-lg font-bold text-ink">Trip optimizer</h3>
        <p className="mt-1 text-sm text-ink-soft">COCO analyses your itinerary for pacing, budget, duplicates and rest — and recommends changes. Nothing is changed automatically; you stay in control.</p>
        <Button onClick={run} disabled={loading} className="mt-4" data-testid="run-optimizer">
          <Sparkle size={18} weight="fill" /> {loading ? "Analysing…" : "Analyse my trip"}
        </Button>
      </div>

      {recs && (
        <div className="space-y-2" data-testid="optimizer-results">
          {recs.map((r, i) => {
            const s = SEV[r.severity] || SEV.info;
            const Icon = s.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card flex items-start gap-3 p-4">
                <Icon size={22} weight="fill" style={{ color: s.color }} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-ink">{r.message}</p>
                  <p className="text-xs uppercase tracking-wide text-ink-faint">{r.type.replace(/_/g, " ")}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
