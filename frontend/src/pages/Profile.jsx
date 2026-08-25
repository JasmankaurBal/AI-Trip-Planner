import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SignOut, EnvelopeSimple, ShieldCheck, GoogleLogo, Suitcase } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { tripsApi } from "../services/api";
import { Button, Card } from "../components/ui";
import { initials } from "../utils/format";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["trips"], queryFn: () => tripsApi.list() });
  const tripCount = data?.total ?? 0;

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold text-ink">Profile</h1>

      <Card className="mt-6 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-brand-soft text-xl font-bold text-brand">
          {user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : initials(user?.name)}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-ink">{user?.name}</h2>
          <p className="flex items-center gap-1.5 text-sm text-ink-soft"><EnvelopeSimple size={15} /> {user?.email}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
            {user?.auth_provider === "google" ? <><GoogleLogo size={13} /> Signed in with Google</> : <><ShieldCheck size={13} /> Email account</>}
          </p>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Suitcase size={20} /></div>
          <div>
            <p className="text-2xl font-extrabold text-ink">{tripCount}</p>
            <p className="text-xs text-ink-faint">Trips planned</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand" style={{ textTransform: "capitalize" }}>{user?.role?.[0]?.toUpperCase()}</div>
          <div>
            <p className="text-lg font-extrabold capitalize text-ink">{user?.role}</p>
            <p className="text-xs text-ink-faint">Account role</p>
          </div>
        </Card>
      </div>

      <Button variant="danger" onClick={doLogout} className="mt-6 w-full" data-testid="profile-logout">
        <SignOut size={18} /> Log out
      </Button>
    </div>
  );
}
