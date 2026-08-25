import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Logo } from "../components/Logo";
import { Button, Input } from "../components/ui";
import GoogleButton from "../components/GoogleButton";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../api/client";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      toast.success("Welcome to COCO!");
      navigate("/app", { replace: true });
    } catch (err) {
      setError(apiError(err, "Could not create account"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src="https://images.unsplash.com/photo-1523248948644-586f1ab2a83e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400" alt="Mountain landscape" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="font-display text-2xl font-bold">Plan smarter. Travel calmer. Discover more.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/"><Logo size={34} /></Link>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
            <h1 className="text-3xl font-extrabold text-ink">Create your account</h1>
            <p className="mt-2 text-ink-soft">Start planning your next adventure with COCO.</p>
          </motion.div>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="register-form">
            <Input id="name" label="Full name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="register-name" placeholder="Jane Explorer" />
            <Input id="email" label="Email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="register-email" placeholder="you@example.com" />
            <Input id="password" label="Password" type="password" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="register-password" placeholder="At least 6 characters" />
            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" data-testid="register-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit">
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleButton label="Sign up with Google" />

          <p className="mt-8 text-center text-sm text-ink-soft">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand hover:underline" data-testid="link-login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
