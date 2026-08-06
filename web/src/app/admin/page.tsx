"use client";

import { useEffect, useState } from "react";
import { Badge, PageTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDateLongFr, formatHmRangeFr } from "@/lib/datetime";

type Dashboard = {
  school: { id: string; name: string; city?: string | null } | null;
  adminName: string;
  today: {
    sessionsDone: number;
    sessionsMissing: number;
    overdueMissing: number;
    upcomingMissing: number;
    expected: number;
    fillRatePercent: number;
    validated: number;
    draft: number;
  };
  week: {
    sessionsDone: number;
    expected: number;
    fillRatePercent: number;
  };
  month: {
    sessionsDone: number;
    expected: number;
    fillRatePercent: number;
  };
  missingSlots: {
    id: string;
    startsAt: string;
    endsAt: string;
    classroom: string;
    subject: string;
    teacher: string;
    overdue?: boolean;
  }[];
};

function ProgressBar({
  value,
  tone = "brand",
}: {
  value: number;
  tone?: "brand" | "warn" | "ok";
}) {
  const color =
    tone === "warn"
      ? "bg-[var(--warn)]"
      : tone === "ok"
        ? "bg-[var(--ok)]"
        : "bg-[var(--brand)]";
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg)]">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  footer,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "brand" | "warn" | "ok";
  footer?: React.ReactNode;
}) {
  const valueClass =
    tone === "brand"
      ? "text-[var(--brand)]"
      : tone === "warn"
        ? "text-[var(--warn)]"
        : tone === "ok"
          ? "text-[var(--ok)]"
          : "text-[var(--brand-ink)]";

  return (
    <div className="surface flex flex-col p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums",
          valueClass,
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/school")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <p className="text-sm text-[var(--muted)]">Chargement…</p>;
  }

  const dateLabel = formatDateLongFr(new Date());
  const t = data.today;
  const fillTone =
    t.fillRatePercent >= 90 ? "ok" : t.fillRatePercent >= 60 ? "brand" : "warn";

  return (
    <div>
      <PageTitle
        title="Tableau de bord"
        subtitle={`${data.school?.name || "Établissement"}${data.school?.city ? ` · ${data.school.city}` : ""}`}
      />

      <div className="surface mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="capitalize text-sm font-medium">{dateLabel}</p>
        </div>
        {data.adminName ? (
          <p className="text-sm text-[var(--muted)]">
            Connecté·e :{" "}
            <span className="font-medium text-[var(--text)]">{data.adminName}</span>
          </p>
        ) : null}
      </div>

      {/* KPIs journée */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Séances saisies"
          value={t.sessionsDone}
          hint={`sur ${t.expected} créneaux prévus`}
          tone="brand"
        />
        <KpiCard
          label="Non renseignées"
          value={t.sessionsMissing}
          hint={
            t.overdueMissing > 0
              ? `${t.overdueMissing} déjà passées · ${t.upcomingMissing} à venir`
              : t.sessionsMissing === 0
                ? "Tout est à jour"
                : "À compléter dans la journée"
          }
          tone={t.sessionsMissing > 0 ? "warn" : "ok"}
        />
        <KpiCard
          label="Taux du jour"
          value={`${t.fillRatePercent}%`}
          tone={fillTone}
          footer={<ProgressBar value={t.fillRatePercent} tone={fillTone === "warn" ? "warn" : "brand"} />}
        />
        <KpiCard
          label="Validées"
          value={t.validated}
          hint={
            t.draft > 0
              ? `${t.draft} encore en brouillon`
              : t.sessionsDone === 0
                ? "Aucune saisie pour l’instant"
                : "Toutes validées"
          }
          tone="ok"
        />
      </div>

      <div className="mt-3 surface p-4">
          <h2 className="text-sm font-semibold text-[var(--brand-ink)]">
            Progression
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-[var(--muted)]">Cette semaine</span>
                <span className="font-semibold tabular-nums">
                  {data.week.fillRatePercent}%
                </span>
              </div>
              <ProgressBar value={data.week.fillRatePercent} />
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                {data.week.sessionsDone} / {data.week.expected} créneaux
                (lun. → aujourd’hui)
              </p>
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-[var(--muted)]">Ce mois</span>
                <span className="font-semibold tabular-nums">
                  {data.month.fillRatePercent}%
                </span>
              </div>
              <ProgressBar value={data.month.fillRatePercent} />
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                {data.month.sessionsDone} / {data.month.expected} créneaux
                estimés
              </p>
            </div>
          </div>
      </div>

      <div className="mt-5">
        <section className="surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--brand-ink)]">
              Créneaux à compléter
            </h2>
            {t.overdueMissing > 0 ? (
              <Badge tone="warn">{t.overdueMissing} en retard</Badge>
            ) : null}
          </div>
          <ul className="mt-3 divide-y divide-[var(--stroke)]">
            {data.missingSlots.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {formatHmRangeFr(s.startsAt, s.endsAt)}
                  </span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {s.classroom} · {s.subject}
                  </span>
                  {s.overdue ? (
                    <span className="mt-0.5 block text-xs text-[var(--warn)]">
                      Créneau passé
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-[var(--muted)]">{s.teacher}</span>
              </li>
            ))}
            {data.missingSlots.length === 0 ? (
              <li className="py-2 text-sm text-[var(--ok)]">
                Toutes les séances du jour sont renseignées.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
