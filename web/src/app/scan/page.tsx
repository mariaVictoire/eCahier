"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button, Field, Input } from "@/components/ui";

export default function ScanPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function onManual(e: FormEvent) {
    e.preventDefault();
    const id = manual.trim();
    if (!id) {
      setError("Indiquez le code de la salle");
      return;
    }
    router.push(`/room/${id}`);
  }

  return (
    <div className="page-shell">
      <AppHeader
        title="Code de la salle"
        backHref="/"
        backLabel="Accueil"
        showBrand={false}
      />

      <form onSubmit={onManual} className="surface p-5">
        <p className="mb-4 text-sm text-[var(--muted)]">
          Entrez le code affiché sur l’étiquette QR (ex. A1, B1, A2).
        </p>
        <Field label="Code salle">
          <Input
            ref={inputRef}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="A1"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
          />
        </Field>
        {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
        <Button type="submit" className="w-full">
          Continuer
        </Button>
      </form>
    </div>
  );
}
