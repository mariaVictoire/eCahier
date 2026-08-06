"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Field, Input, PageTitle, Select } from "@/components/ui";
import { NationalYearBascule } from "@/components/national-year-bascule";
import { cn } from "@/lib/utils";
import {
  currentSchoolYearLabel,
  nextSchoolYearFromLabel,
} from "@/lib/school-year-client";

type PeriodKind = "holiday" | "strike";

type Period = {
  id: string;
  yearLabel: string;
  kind: PeriodKind;
  name: string;
  startsOn: string;
  endsOn: string;
};

function formatDayFr(isoDay: string) {
  const [y, m, d] = isoDay.split("-").map(Number);
  if (!y || !m || !d) return isoDay;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysInclusive(startsOn: string, endsOn: string) {
  const a = Date.parse(`${startsOn}T00:00:00Z`);
  const b = Date.parse(`${endsOn}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

export default function NationalAnneesPage() {
  const calendarYear = currentSchoolYearLabel();
  const nextLabel = nextSchoolYearFromLabel(calendarYear);

  const [yearLabel, setYearLabel] = useState(calendarYear);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [listFilter, setListFilter] = useState<"all" | PeriodKind>("all");

  const [kind, setKind] = useState<PeriodKind>("holiday");
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const hRes = await fetch(
        `/api/holidays?yearLabel=${encodeURIComponent(yearLabel)}`,
      );
      const hJson = await hRes.json();
      if (!hRes.ok) {
        setError(hJson.message || "Chargement impossible");
      } else {
        setPeriods(
          (hJson.holidays || []).map((h: Period) => ({
            ...h,
            kind: h.kind === "strike" ? "strike" : "holiday",
          })),
        );
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [yearLabel]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearLabel, kind, name, startsOn, endsOn }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Enregistrement impossible");
      return;
    }
    setOk(`« ${data.name} » enregistré.`);
    setName("");
    setStartsOn("");
    setEndsOn("");
    setShowForm(false);
    await load();
  }

  async function onDelete(id: string, label: string) {
    if (!window.confirm(`Supprimer « ${label} » ?`)) return;
    const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Suppression impossible");
      return;
    }
    setOk(`« ${label} » supprimé.`);
    await load();
  }

  const holidays = useMemo(
    () => periods.filter((p) => p.kind === "holiday"),
    [periods],
  );
  const strikes = useMemo(
    () => periods.filter((p) => p.kind === "strike"),
    [periods],
  );

  const visiblePeriods = useMemo(() => {
    const list =
      listFilter === "all"
        ? periods
        : periods.filter((p) => p.kind === listFilter);
    return [...list].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  }, [periods, listFilter]);

  const yearOptions = Array.from(
    new Set([
      calendarYear,
      nextLabel,
      ...periods.map((h) => h.yearLabel),
    ]),
  ) as string[];

  return (
    <div>
      <PageTitle
        title="Années scolaires"
        subtitle="Calendrier national, bascule et périodes non scolaires"
      />

      <section className="surface mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Année calendaire
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums text-[var(--brand-ink)]">
            {calendarYear}
          </p>
        </div>
        <NationalYearBascule onDone={load} />
      </section>

      <section className="surface flex-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--brand-ink)]">
              Vacances & grèves
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Périodes nationales pour {yearLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Année scolaire"
              className="focus-ring h-9 rounded-lg border border-[var(--stroke)] bg-white px-2.5 text-sm text-[var(--text)]"
              value={yearLabel}
              onChange={(e) => setYearLabel(e.target.value)}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant={showForm ? "secondary" : "primary"}
              size="sm"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Fermer" : "Ajouter"}
            </Button>
          </div>
        </div>

        {ok ? <p className="mt-3 text-sm text-[var(--ok)]">{ok}</p> : null}
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}

        {showForm ? (
          <form
            onSubmit={onCreate}
            className="mt-4 space-y-1 rounded-[12px] border border-[var(--stroke)] bg-[var(--bg)]/60 p-3 sm:p-4"
          >
            <Field label="Type">
              <Select
                value={kind}
                onChange={(e) => setKind(e.target.value as PeriodKind)}
              >
                <option value="holiday">Vacances scolaires</option>
                <option value="strike">Grève enseignants</option>
              </Select>
            </Field>
            <Field label="Libellé">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === "strike"
                    ? "Grève nationale — 24 h"
                    : "Vacances de Noël"
                }
                required
              />
            </Field>
            <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
              <Field label="Début">
                <Input
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                  required
                />
              </Field>
              <Field label="Fin">
                <Input
                  type="date"
                  value={endsOn}
                  onChange={(e) => setEndsOn(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Button type="submit" className="mt-2 w-full sm:w-auto" disabled={saving}>
              {saving
                ? "Enregistrement…"
                : kind === "strike"
                  ? "Enregistrer la grève"
                  : "Enregistrer les vacances"}
            </Button>
          </form>
        ) : null}

        <div className="mt-4 flex gap-1 rounded-lg bg-[var(--bg)] p-1">
          {(
            [
              { id: "all", label: `Tout (${periods.length})` },
              { id: "holiday", label: `Vacances (${holidays.length})` },
              { id: "strike", label: `Grèves (${strikes.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setListFilter(tab.id)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition sm:text-sm",
                listFilter === tab.id
                  ? "bg-white text-[var(--brand-ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-[var(--muted)]">Chargement…</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--stroke)]">
            {visiblePeriods.map((h) => {
              const days = daysInclusive(h.startsOn, h.endsOn);
              return (
                <li
                  key={h.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 gap-3">
                    <span
                      className={cn(
                        "mt-1 h-8 w-1 shrink-0 rounded-full",
                        h.kind === "strike"
                          ? "bg-[var(--warn)]"
                          : "bg-[var(--brand)]",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {h.name}
                        <Badge tone={h.kind === "strike" ? "warn" : "info"}>
                          {h.kind === "strike" ? "Grève" : "Vacances"}
                        </Badge>
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {formatDayFr(h.startsOn)} → {formatDayFr(h.endsOn)}
                        {days ? ` · ${days} j` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(h.id, h.name)}
                  >
                    Supprimer
                  </Button>
                </li>
              );
            })}
            {visiblePeriods.length === 0 ? (
              <li className="py-8 text-center text-sm text-[var(--muted)]">
                {listFilter === "strike"
                  ? `Aucune grève pour ${yearLabel}.`
                  : listFilter === "holiday"
                    ? `Aucune vacance pour ${yearLabel}.`
                    : `Aucune période pour ${yearLabel}.`}
                {!showForm ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="font-medium text-[var(--brand)]"
                      onClick={() => setShowForm(true)}
                    >
                      Ajouter
                    </button>
                  </>
                ) : null}
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}
