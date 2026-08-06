"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, PageTitle, Select } from "@/components/ui";
import { formatShortDate } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  status: string;
  sessionDate: string;
  classroom: { name: string };
  subject: { name: string };
  teacher: { firstName: string; lastName: string };
  room: { label: string };
};

export default function AdminCahiersPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const qs = status ? `?status=${status}` : "";
    fetch(`/api/sessions${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Accès refusé");
        return r.json();
      })
      .then((data) => setItems(data.items || []))
      .catch(() => setError("Impossible de charger les cahiers"));
  }, [status]);

  return (
    <div>
      <PageTitle
        title="Cahiers de textes"
        subtitle="Consultez et corrigez les séances. Les enseignants ne modifient plus après validation."
      />

      <div className="mb-4 max-w-xs">
        <label className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">
          Statut
        </label>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tous</option>
          <option value="validated">Validés</option>
          <option value="draft">Brouillons</option>
        </Select>
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/session/${item.id}?from=admin`}
              className="surface flex items-start justify-between gap-3 px-4 py-3.5 transition hover:border-[var(--stroke-strong)]"
            >
              <div>
                <p className="font-semibold">
                  {item.title || "Séance sans titre"}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {formatShortDate(item.sessionDate)} · {item.classroom.name} ·{" "}
                  {item.subject.name}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {item.teacher.firstName} {item.teacher.lastName} ·{" "}
                  {item.room.label}
                </p>
              </div>
              <Badge tone={item.status === "validated" ? "ok" : "warn"}>
                {item.status === "validated" ? "Validé" : "Brouillon"}
              </Badge>
            </Link>
          </li>
        ))}
        {!error && items.length === 0 ? (
          <li className="surface px-4 py-8 text-center text-sm text-[var(--muted)]">
            Aucune séance pour ce filtre.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
