import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash, Receipt, ArrowRight, Scales } from "@phosphor-icons/react";
import { expensesApi, collabApi } from "../../services/api";
import { Button, Input, Select, Modal, Card, Badge } from "../ui";
import { EmptyState, LoadingState } from "../ui/states";
import { EXPENSE_CATEGORIES } from "../../utils";
import { money, fmtDate } from "../../utils/format";
import { apiError } from "../../api/client";

const CAT_COLOR = { accommodation: "#2C5530", transport: "#4A6E82", food: "#D47A57", activities: "#D19C4C", shopping: "#DB2777", miscellaneous: "#8A8F87", emergency: "#D6553F" };

export default function ExpensesTab({ trip }) {
  const qc = useQueryClient();
  const tripId = trip.id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", category: "food", description: "", payer: "", split_between: [] });

  const { data, isLoading } = useQuery({ queryKey: ["expenses", tripId], queryFn: () => expensesApi.list(tripId) });
  const { data: settle } = useQuery({ queryKey: ["settlements", tripId], queryFn: () => expensesApi.settlements(tripId) });
  const { data: membersData } = useQuery({ queryKey: ["members", tripId], queryFn: () => collabApi.members(tripId) });

  const expenses = data?.expenses || [];
  const members = membersData?.members || [];
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const save = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return toast.error("Enter an amount");
    try {
      await expensesApi.add(tripId, {
        amount: Number(form.amount),
        currency: trip.currency,
        category: form.category,
        description: form.description,
        payer: form.payer || undefined,
        split_between: form.split_between,
      });
      qc.invalidateQueries({ queryKey: ["expenses", tripId] });
      qc.invalidateQueries({ queryKey: ["settlements", tripId] });
      qc.invalidateQueries({ queryKey: ["budget", tripId] });
      setOpen(false);
      setForm({ amount: "", category: "food", description: "", payer: "", split_between: [] });
      toast.success("Expense added");
    } catch (err) { toast.error(apiError(err)); }
  };

  const del = async (id) => {
    await expensesApi.remove(tripId, id);
    qc.invalidateQueries({ queryKey: ["expenses", tripId] });
    qc.invalidateQueries({ queryKey: ["settlements", tripId] });
    qc.invalidateQueries({ queryKey: ["budget", tripId] });
    toast.success("Deleted");
  };

  const toggleSplit = (name) => setForm((f) => ({ ...f, split_between: f.split_between.includes(name) ? f.split_between.filter((n) => n !== name) : [...f.split_between, name] }));

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-ink">Expenses</h3>
          <p className="text-sm text-ink-faint">Total logged: {money(total, trip.currency)}</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="add-expense"><Plus size={16} weight="bold" /> Add</Button>
      </div>

      {settle?.settlements?.length > 0 && (
        <Card>
          <h4 className="mb-3 flex items-center gap-2 font-bold text-ink"><Scales size={18} /> Suggested settlements</h4>
          <div className="space-y-2" data-testid="settlements">
            {settle.settlements.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-medium text-ink"><b>{s.from}</b> <ArrowRight size={14} /> <b>{s.to}</b></span>
                <span className="font-bold text-brand">{money(s.amount, trip.currency)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" description="Log what you spend to track your budget and split costs with travel buddies." action={<Button onClick={() => setOpen(true)}>Add first expense</Button>} />
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="card flex items-center justify-between gap-3 p-4" data-testid="expense-item">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge color={CAT_COLOR[e.category]}>{e.category}</Badge>
                  <span className="text-xs text-ink-faint">{fmtDate(e.date)}</span>
                </div>
                <p className="mt-1 truncate font-semibold text-ink">{e.description || "Expense"}</p>
                <p className="text-xs text-ink-faint">Paid by {e.payer}{e.split_between?.length ? ` · split ${e.split_between.length} ways` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">{money(e.amount, e.currency)}</span>
                <button onClick={() => del(e.id)} className="rounded-lg p-1.5 text-ink-faint hover:bg-danger/10 hover:text-danger" data-testid="delete-expense"><Trash size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add expense" testId="expense-modal">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={`Amount (${trip.currency})`} type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="expense-amount" />
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="expense-category">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </Select>
          </div>
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="expense-desc" />
          <Input label="Paid by" placeholder="Your name" value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value })} data-testid="expense-payer" />
          {members.length > 1 && (
            <div>
              <p className="label">Split between</p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <button type="button" key={m.id} onClick={() => toggleSplit(m.name)} className={`chip ${form.split_between.includes(m.name) ? "chip-active" : ""}`}>{m.name}</button>
                ))}
              </div>
            </div>
          )}
          <Button type="submit" className="w-full" data-testid="expense-save">Add expense</Button>
        </form>
      </Modal>
    </div>
  );
}
