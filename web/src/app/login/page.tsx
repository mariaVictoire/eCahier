"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@lycee.ga");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError("Cet accès est réservé à la direction de l’établissement.");
      return;
    }
    router.push("/admin");
  }

  return (
    <div className="page-shell">
      <AppHeader
        title="Direction"
        backHref="/"
        backLabel="Accueil"
        showBrand={false}
      />

      <div className="surface overflow-hidden">
        <div className="border-b border-[var(--stroke)] bg-[var(--brand-soft)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--brand-ink)]">
            Espace direction
          </p>
          <p className="text-xs text-[var(--muted)]">
            Consultation des cahiers, corrections, emploi du temps
          </p>
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
