"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { formatDateLongFr } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type NationalDashboard = {
  metrics: {
    schools: number;
    teachers: number;
    classrooms: number;
    roomsActive: number;
    sessionsDoneToday: number;
    expectedToday: number;
    fillRatePercent: number;
  };
  bySchool: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    teachers: number;
    classrooms: number;
    rooms: number;
    sessionsDoneToday: number;
    expectedToday: number;
    fillRatePercent: number;
  }[];
};

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--brand-ink)]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export default function NationalDashboardPage() {
  const [data, setData] = useState<NationalDashboard | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/national")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <p className="text-sm text-[var(--muted)]">Chargement…</p>;
  }

  const m = data.metrics;

  return (
    <div>
      <PageTitle
        title="Supervision nationale"
        subtitle="Suivi des établissements eCahier"
        action={
          <Link
            href="/national/ecoles"
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white"
          >
            Gérer les écoles
          </Link>
        }
      />

      <div className="surface mb-5 px-4 py-3">
        <p className="capitalize text-sm font-medium">{formatDateLongFr(new Date())}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Établissements" value={m.schools} />
        <Kpi label="Enseignants" value={m.teachers} />
        <Kpi label="Classes" value={m.classrooms} />
        <Kpi
          label="Taux du jour"
          value={`${m.fillRatePercent}%`}
          hint={`${m.sessionsDoneToday} / ${m.expectedToday} créneaux`}
        />
      </div>

      <section className="surface mt-5 p-4">
        <h2 className="text-sm font-semibold text-[var(--brand-ink)]">
          Par établissement
        </h2>
        <ul className="mt-3 divide-y divide-[var(--stroke)]">
          {data.bySchool.map((school) => (
            <li key={school.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--text)]">{school.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {school.code}
                    {school.city ? ` · ${school.city}` : ""}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    school.fillRatePercent >= 80
                      ? "text-[var(--ok)]"
                      : school.fillRatePercent >= 50
                        ? "text-[var(--brand)]"
                        : "text-[var(--warn)]",
                  )}
                >
                  {school.fillRatePercent}%
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)]"
                  style={{ width: `${Math.min(100, school.fillRatePercent)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                {school.sessionsDoneToday}/{school.expectedToday} saisies ·{" "}
                {school.classrooms} classes · {school.teachers} comptes
              </p>
            </li>
          ))}
          {data.bySchool.length === 0 ? (
            <li className="py-3 text-sm text-[var(--muted)]">
              Aucun établissement.{" "}
              <Link href="/national/ecoles" className="text-[var(--brand)]">
                En créer un
              </Link>
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
