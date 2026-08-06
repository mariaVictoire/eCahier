"use client";

import { Suspense } from "react";
import SessionForm from "./session-form";

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <p className="text-sm text-[var(--muted)]">Chargement…</p>
        </div>
      }
    >
      <SessionForm />
    </Suspense>
  );
}
