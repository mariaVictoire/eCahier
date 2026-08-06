"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  currentSchoolYearLabel,
  nextSchoolYearFromLabel,
} from "@/lib/school-year-client";

export function NationalYearBascule({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const nextLabel = nextSchoolYearFromLabel(currentSchoolYearLabel());

  async function bascule() {
    const ok = window.confirm(
      `Basculer tous les établissements vers ${nextLabel} ?\n\n` +
        `Chaque année en cours sera archivée (aucune suppression).\n` +
        `Les classes seront reprises ; les emplois du temps sont à refaire.`,
    );
    if (!ok) return;

    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/school-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copyClassrooms: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.message || "Échec de la bascule");
        return;
      }
      setMessage(
        `${json.processed} établissement(s) basculé(s) vers ${nextLabel}.`,
      );
      onDone?.();
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full sm:w-auto">
      <Button
        type="button"
        variant="primary"
        className="w-full sm:w-auto"
        disabled={busy}
        onClick={bascule}
      >
        {busy ? "Bascule…" : `Bascule ${nextLabel}`}
      </Button>
      {message ? (
        <p className="mt-2 text-xs text-[var(--muted)] sm:text-right">
          {message}
        </p>
      ) : null}
    </div>
  );
}
