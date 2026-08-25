import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Logo } from "../components/Logo";
import { Button, Input } from "../components/ui";
import { authApi } from "../services/api";
import { apiError } from "../api/client";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    setError("");
    try {
      await authApi.reset(token, password);
      toast.success("Password updated. Please sign in.");
      navigate("/login");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/"><Logo size={34} /></Link>
        <h1 className="mt-10 text-3xl font-extrabold text-ink">Set a new password</h1>
        {!token ? (
          <p className="mt-4 text-sm text-danger">Missing or invalid reset token.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="reset-form">
            <Input label="New password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reset-password" />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="reset-submit">
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
