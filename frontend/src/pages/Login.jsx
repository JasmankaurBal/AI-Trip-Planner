import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Logo } from "../components/Logo";
import { Button, Input } from "../components/ui";
import GoogleButton from "../components/GoogleButton";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../api/client";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      toast.success("Welcome back!");
      navigate(location.state?.from || "/app", { replace: true });
    } catch (err) {
      setError(apiError(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/"><Logo size={34} /></Link>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
            <h1 className="text-3xl font-extrabold text-ink">Welcome back</h1>
            <p className="mt-2 text-ink-soft">Your trips are waiting. Let's keep exploring.</p>
          </motion.div>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <Input id="email" label="Email" type="email" required autoComplete="email"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="login-email" placeholder="you@example.com" />
            <Input id="password" label="Password" type="password" required autoComplete="current-password"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="login-password" placeholder="••••••••" />
            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" data-testid="login-error">{error}</p>}
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-semibold text-brand hover:underline">Forgot password?</Link>
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton />

          <p className="mt-8 text-center text-sm text-ink-soft">
            New to COCO?{" "}
            <Link to="/register" className="font-semibold text-brand hover:underline" data-testid="link-register">Create an account</Link>
          </p>
        </div>
      </div>
      <div className="relative hidden lg:block">
        <img src="https://images.unsplash.com/reserve/91JuTaUSKaMh2yjB1C4A_IMG_9284.jpg?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400" alt="Traveler at sunset" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="font-display text-2xl font-bold">"The best trips begin with a good companion."</p>
        </div>
      </div>
    </div>
  );
}
