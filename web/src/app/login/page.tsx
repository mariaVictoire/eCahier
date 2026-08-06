"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

type AdminProfile = "school" | "national";

const PROFILES: Record<
  AdminProfile,
  { label: string; email: string; password: string }
> = {
  school: {
    label: "Direction",
    email: "admin@lycee.ga",
    password: "admin123",
  },
  national: {
    label: "National",
    email: "national@ecahier.ga",
    password: "national123",
  },
};

export default function LoginPage() {
  const router = useRouter();
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
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Identifiants incorrects");
      return;
    }
    if (data.user.role === "teacher") {
      setError("Cet accès est réservé aux administrateurs.");
      return;
    }
    router.push(data.user.role === "national_admin" ? "/national" : "/admin");
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

        <div className="grid grid-cols-2 gap-1.5 bg-[var(--bg)] p-2">
          {(Object.keys(PROFILES) as AdminProfile[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => selectProfile(key)}
              className={cn(
                "rounded-[10px] px-3 py-2.5 text-center text-sm font-semibold transition",
                profile === key
                  ? "bg-white text-[var(--brand)] shadow-sm ring-1 ring-[var(--brand)]/25"
                  : "text-[var(--text)] hover:bg-white/70",
              )}
            >
              {PROFILES[key].label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="p-4">
          <Field label="Adresse e-mail">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Mot de passe">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          {error ? (
            <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
