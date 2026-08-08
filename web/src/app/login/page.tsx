"use client";

import { FormEvent, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

type AdminProfile = "school" | "national";

const IS_DEMO = process.env.NODE_ENV !== "production";

const PROFILES: Record<
  AdminProfile,
  { label: string; email: string; password: string }
> = {
  school: {
    label: "Direction",
    email: IS_DEMO ? "admin@lycee.ga" : "",
    password: IS_DEMO ? "admin123" : "",
  },
  national: {
    label: "National",
    email: IS_DEMO ? "national@ecahier.ga" : "",
    password: IS_DEMO ? "national123" : "",
  },
};

export default function LoginPage() {
  const [profile, setProfile] = useState<AdminProfile>("school");
  const [email, setEmail] = useState(PROFILES.school.email);
  const [password, setPassword] = useState(PROFILES.school.password);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function selectProfile(next: AdminProfile) {
    setProfile(next);
    setEmail(PROFILES[next].email);
    setPassword(PROFILES[next].password);
    setError("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Identifiants incorrects");
        setLoading(false);
        return;
      }
      if (data.user.role === "teacher") {
        setError("Cet accès est réservé aux administrateurs.");
        setLoading(false);
        return;
      }
      window.location.href =
        data.user.role === "national_admin" ? "/national" : "/admin";
    } catch {
      setError("Connexion impossible");
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <AppHeader
        title="Admin"
        backHref="/"
        backLabel="Accueil"
        showBrand={false}
      />

      <div className="surface overflow-hidden">
        <div className="border-b border-[var(--stroke)] bg-[var(--brand-soft)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--brand-ink)]">
            Espace Admin
          </p>
          <p className="text-xs text-[var(--muted)]">
            Direction d’établissement ou administration nationale
          </p>
        </div>

        <div className="p-4">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-[10px] bg-[var(--bg)] p-1">
            {(Object.keys(PROFILES) as AdminProfile[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectProfile(key)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition",
                  profile === key
                    ? "bg-white text-[var(--brand-ink)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--muted)]",
                )}
              >
                {PROFILES[key].label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="Adresse e-mail">
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Mot de passe">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
