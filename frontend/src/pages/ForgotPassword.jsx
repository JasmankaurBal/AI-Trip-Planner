import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Button, Input } from "../components/ui";
import { authApi } from "../services/api";
import { apiError } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.forgot(email.trim());
      setSent(true);
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
        <h1 className="mt-10 text-3xl font-extrabold text-ink">Reset password</h1>
        {sent ? (
          <div className="mt-6 rounded-xl bg-brand-soft px-4 py-4 text-sm text-brand" data-testid="forgot-sent">
            If an account exists for <b>{email}</b>, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="forgot-form">
            <p className="text-ink-soft">Enter your email and we'll send a reset link.</p>
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="forgot-submit">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <p className="mt-8 text-center text-sm">
          <Link to="/login" className="font-semibold text-brand hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
