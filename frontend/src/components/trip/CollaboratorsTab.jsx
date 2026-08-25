import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { UserPlus, Trash, ThumbsUp, Lightbulb, Crown } from "@phosphor-icons/react";
import { collabApi } from "../../services/api";
import { Button, Input, Card } from "../ui";
import { LoadingState } from "../ui/states";
import { initials } from "../../utils/format";
import { apiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export default function CollaboratorsTab({ trip }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const tripId = trip.id;
  const isOwner = trip.owner_id === user?.id;
  const [email, setEmail] = useState("");
  const [suggestion, setSuggestion] = useState("");

  const { data: membersData, isLoading } = useQuery({ queryKey: ["members", tripId], queryFn: () => collabApi.members(tripId) });
  const { data: sugData } = useQuery({ queryKey: ["suggestions", tripId], queryFn: () => collabApi.suggestions(tripId) });
  const members = membersData?.members || [];
  const suggestions = sugData?.suggestions || [];

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await collabApi.invite(tripId, email.trim());
      qc.invalidateQueries({ queryKey: ["members", tripId] });
      setEmail("");
      toast.success("Member added");
    } catch (err) { toast.error(apiError(err)); }
  };
  const removeMember = async (id) => { await collabApi.removeMember(tripId, id); qc.invalidateQueries({ queryKey: ["members", tripId] }); };

  const addSuggestion = async (e) => {
    e.preventDefault();
    if (!suggestion.trim()) return;
    await collabApi.addSuggestion(tripId, suggestion.trim());
    setSuggestion("");
    qc.invalidateQueries({ queryKey: ["suggestions", tripId] });
  };
  const vote = async (id) => { await collabApi.vote(tripId, id); qc.invalidateQueries({ queryKey: ["suggestions", tripId] }); };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <Card>
        <h3 className="mb-3 text-lg font-bold text-ink">Travel companions</h3>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3" data-testid="member-item">
              <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-brand-soft text-sm font-bold text-brand">
                {m.picture ? <img src={m.picture} alt="" className="h-full w-full object-cover" /> : initials(m.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{m.name} {m.role === "owner" && <Crown size={13} className="inline text-ochre" weight="fill" />}</p>
                <p className="truncate text-xs text-ink-faint">{m.email}</p>
              </div>
              {isOwner && m.role !== "owner" && (
                <button onClick={() => removeMember(m.id)} className="text-ink-faint hover:text-danger" data-testid="remove-member"><Trash size={16} /></button>
              )}
            </div>
          ))}
        </div>
        {isOwner && (
          <form onSubmit={invite} className="mt-4 flex gap-2 border-t border-border pt-4">
            <Input placeholder="friend@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="invite-email" />
            <Button type="submit" data-testid="invite-submit"><UserPlus size={16} weight="bold" /> Invite</Button>
          </form>
        )}
        <p className="mt-2 text-xs text-ink-faint">Invitees must already have a COCO account.</p>
      </Card>

      <Card>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink"><Lightbulb size={18} /> Group ideas</h3>
        <form onSubmit={addSuggestion} className="flex gap-2">
          <Input placeholder="Suggest an activity or place…" value={suggestion} onChange={(e) => setSuggestion(e.target.value)} data-testid="suggestion-input" />
          <Button type="submit" data-testid="suggestion-add">Add</Button>
        </form>
        <div className="mt-3 space-y-2">
          {suggestions.length === 0 && <p className="text-sm text-ink-faint">No ideas yet — add the first one!</p>}
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2" data-testid="suggestion-item">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{s.text}</p>
                <p className="text-xs text-ink-faint">by {s.author}</p>
              </div>
              <button onClick={() => vote(s.id)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm font-semibold text-brand hover:bg-brand-soft" data-testid="suggestion-vote">
                <ThumbsUp size={15} weight="fill" /> {s.vote_count}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
