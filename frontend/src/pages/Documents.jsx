import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FolderLock, Plus, Trash, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { documentsApi } from "../services/api";
import { Button, Input, Select, Modal } from "../components/ui";
import { EmptyState, LoadingState, ErrorState } from "../components/ui/states";
import { fmtDate } from "../utils/format";
import { apiError } from "../api/client";

const DOC_TYPES = ["Passport", "Visa", "ID card", "Insurance", "Ticket", "Booking", "Vaccination", "Other"];

export default function Documents() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", doc_type: "Passport", expiry_date: "", number: "", notes: "" });
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["documents"], queryFn: () => documentsApi.list() });
  const docs = data?.documents || [];

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      await documentsApi.create({ ...form, expiry_date: form.expiry_date || null });
      qc.invalidateQueries({ queryKey: ["documents"] });
      setOpen(false);
      setForm({ name: "", doc_type: "Passport", expiry_date: "", number: "", notes: "" });
      toast.success("Document saved");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const remove = async (id) => {
    await documentsApi.remove(id);
    qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Removed");
  };

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-ink">Document vault</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft"><ShieldCheck size={15} /> Private to you. We store details only — never share document contents.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="add-document"><Plus size={18} weight="bold" /> Add</Button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-ink-soft">
        <WarningCircle size={18} className="mt-0.5 shrink-0 text-warning" />
        File uploads require a secure object-storage provider, which isn't configured in this build. You can safely store document metadata (name, type, number, expiry) here.
      </div>

      <div className="mt-6">
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : docs.length === 0 ? (
          <EmptyState icon={FolderLock} title="No documents yet" description="Keep track of passports, visas, insurance and booking references." action={<Button onClick={() => setOpen(true)}>Add a document</Button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {docs.map((d) => (
              <div key={d.id} className="card flex items-start justify-between gap-3 p-4" data-testid="document-item">
                <div>
                  <span className="chip text-xs">{d.doc_type}</span>
                  <h3 className="mt-2 font-bold text-ink">{d.name}</h3>
                  {d.number && <p className="font-mono text-sm text-ink-soft">#{d.number}</p>}
                  {d.expiry_date && <p className="mt-1 text-xs text-ink-faint">Expires {fmtDate(d.expiry_date)}</p>}
                  {d.notes && <p className="mt-1 text-sm text-ink-soft">{d.notes}</p>}
                </div>
                <button onClick={() => remove(d.id)} className="rounded-lg p-2 text-ink-faint hover:bg-danger/10 hover:text-danger" data-testid="delete-document"><Trash size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add document" testId="document-modal">
        <form onSubmit={save} className="space-y-4">
          <Input label="Name" placeholder="My passport" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="doc-name" />
          <Select label="Type" value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} data-testid="doc-type">
            {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Number (optional)" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} data-testid="doc-number" />
            <Input label="Expiry (optional)" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} data-testid="doc-expiry" />
          </div>
          <Input label="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="doc-notes" />
          <Button type="submit" className="w-full" data-testid="doc-save">Save document</Button>
        </form>
      </Modal>
    </div>
  );
}
