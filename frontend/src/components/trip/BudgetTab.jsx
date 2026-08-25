import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PencilSimple, Wallet } from "@phosphor-icons/react";
import { tripsApi } from "../../services/api";
import { Button, Input, Card, Modal } from "../ui";
import { LoadingState } from "../ui/states";
import { money } from "../../utils/format";
import { apiError } from "../../api/client";

const CAT_COLORS = ["#2C5530", "#D47A57", "#D19C4C", "#4A6E82", "#8B5CF6", "#2F9E68", "#DB2777"];

function Stat({ label, value, accent }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-2xl font-extrabold" style={{ color: accent || "#1A1C19" }}>{value}</p>
    </Card>
  );
}

export default function BudgetTab({ trip }) {
  const qc = useQueryClient();
  const tripId = trip.id;
  const [edit, setEdit] = useState(false);
  const [budgetVal, setBudgetVal] = useState(trip.budget || "");
  const { data, isLoading } = useQuery({ queryKey: ["budget", tripId], queryFn: () => tripsApi.budget(tripId) });

  if (isLoading || !data) return <LoadingState label="Crunching numbers…" />;
  const cur = data.currency;

  const spentData = Object.entries(data.spent_by_category).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  const saveBudget = async () => {
    try {
      await tripsApi.updateBudget(tripId, { budget: Number(budgetVal) || 0 });
      qc.invalidateQueries({ queryKey: ["budget", tripId] });
      qc.invalidateQueries({ queryKey: ["trip", tripId] });
      setEdit(false);
      toast.success("Budget updated");
    } catch (err) { toast.error(apiError(err)); }
  };

  const pctSpent = data.budget ? Math.min(100, Math.round((data.total_spent / data.budget) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-ink">Budget overview</h3>
        <Button variant="secondary" onClick={() => setEdit(true)} data-testid="edit-budget"><PencilSimple size={16} /> Set budget</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Budget" value={data.budget ? money(data.budget, cur) : "—"} />
        <Stat label="Spent" value={money(data.total_spent, cur)} accent="#D47A57" />
        <Stat label="Remaining" value={money(data.remaining, cur)} accent={data.remaining < 0 ? "#D6553F" : "#2F9E68"} />
        <Stat label="Projected" value={money(data.projected_total, cur)} accent="#4A6E82" />
      </div>

      {data.budget > 0 && (
        <Card>
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-ink">Spent {pctSpent}%</span>
            <span className="text-ink-faint">{money(data.total_spent, cur)} / {money(data.budget, cur)}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${pctSpent}%`, background: pctSpent > 90 ? "#D6553F" : "#2C5530" }} />
          </div>
          <p className="mt-2 text-xs text-ink-faint">Estimated activity cost: {money(data.estimated_activities_cost, cur)} · Daily average: {money(data.daily_average, cur)}</p>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h4 className="mb-3 font-bold text-ink">Spending by category</h4>
          {spentData.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-ink-faint">
              <Wallet size={28} /><p className="text-sm">No expenses logged yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={spentData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {spentData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(v, cur)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <h4 className="mb-3 font-bold text-ink">Category breakdown</h4>
          <div className="space-y-2">
            {Object.entries(data.spent_by_category).map(([cat, val], i) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} /> {cat}
                </span>
                <span className="font-semibold text-ink">{money(val, cur)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title="Set budget" testId="budget-modal">
        <div className="space-y-4">
          <Input label={`Total budget (${cur})`} type="number" min="0" value={budgetVal} onChange={(e) => setBudgetVal(e.target.value)} data-testid="budget-input" />
          <Button onClick={saveBudget} className="w-full" data-testid="budget-save">Save budget</Button>
        </div>
      </Modal>
    </div>
  );
}
