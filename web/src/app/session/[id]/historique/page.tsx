"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Badge, Button, Field, Input } from "@/components/ui";
import { formatDateShortFr } from "@/lib/datetime";

type HistoryItem = {
  id: string;
  sessionDate: string;
  title: string;
  status: string;
  classroom: string;
  subject: string;
  isCurrent: boolean;
  hasContent: boolean;
};

export default function HistoriquePage() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(
    async (fromDay: string, toDay: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (fromDay) params.set("from", fromDay);
        if (toDay) params.set("to", toDay);
        const qs = params.toString();
        const res = await fetch(
          `/api/sessions/${id}/history${qs ? `?${qs}` : ""}`,
        );
        if (!res.ok) {
          throw new Error((await res.json()).message || "Accès refusé");
        }
        const data = await res.json();
        setItems(data.items || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible de charger");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    load("", "");
  }, [load]);

  function applyFilter(e: FormEvent) {
    e.preventDefault();
    load(from, to);
  }

  function clearFilter() {
    setFrom("");
    setTo("");
    load("", "");
  }

  if (error && items.length === 0 && !loading) {
    return (
      <div className="page-shell">
        <AppHeader
          backHref={`/session/${id}/hub`}
          backLabel="Menu"
          showBrand={false}
        />
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="page-shell pb-10 md:max-w-lg">
      <AppHeader
        backHref={`/session/${id}/hub`}
        backLabel="Menu"
        showBrand={false}
      />

      <form
        onSubmit={applyFilter}
        className="surface mb-4 grid grid-cols-2 gap-3 p-3"
      >
        <Field label="Du">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Au">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <div className="col-span-2 flex gap-2">
          <Button type="submit" className="flex-1" size="sm">
            Filtrer
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            size="sm"
            onClick={clearFilter}
          >
            Tout voir
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Aucune saisie pour cette période.
        </p>
      ) : (
        <ul className="surface divide-y divide-[var(--stroke)] overflow-hidden">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={
                  item.isCurrent
                    ? `/session/${item.id}/cahier`
                    : `/session/${item.id}/cahier?from=historique&hub=${id}`
                }
                className="block px-4 py-3 transition hover:bg-[var(--bg)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {formatDateShortFr(item.sessionDate)} · {item.classroom} ·{" "}
                      {item.subject}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                      {item.hasContent ? item.title : "Séance non renseignée"}
                    </p>
                  </div>
                  <Badge tone={item.status === "validated" ? "ok" : "warn"}>
                    {item.isCurrent
                      ? "Aujourd’hui"
                      : item.status === "validated"
                        ? "Validée"
                        : "Brouillon"}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
