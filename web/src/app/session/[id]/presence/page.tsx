"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui";

type AttendanceItem = {
  studentId: string;
  firstName: string;
  lastName: string;
  absent: boolean;
  late: boolean;
};

export default function PresencePage() {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<AttendanceItem[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Chargement…");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${id}/attendance`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message || "Accès refusé");
        return r.json();
      })
      .then((data) => {
        setItems(data.items);
        setCanEdit(!!data.canEdit);
        setSaveState(data.canEdit ? "Prêt" : "Lecture seule");
      })
      .catch((e: Error) => {
        setError(e.message || "Impossible de charger");
        setSaveState("Erreur");
      });
  }, [id]);

  function scheduleSave(next: AttendanceItem[]) {
    if (!canEdit) return;
    setSaveState("Enregistrement…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/sessions/${id}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marks: next.map((i) => ({
            studentId: i.studentId,
            absent: i.absent,
            late: i.late,
          })),
        }),
      });
      setSaveState(res.ok ? "Enregistré" : "Erreur d’enregistrement");
    }, 400);
  }

  function toggle(studentId: string, field: "absent" | "late") {
    if (!canEdit) return;
    setItems((prev) => {
      const next = prev.map((row) => {
        if (row.studentId !== studentId) return row;
        if (field === "absent") {
          const absent = !row.absent;
          return { ...row, absent, late: absent ? false : row.late };
        }
        if (row.absent) return row;
        return { ...row, late: !row.late };
      });
      scheduleSave(next);
      return next;
    });
  }

  const presentCount = items.filter((i) => !i.absent).length;
  const absentCount = items.filter((i) => i.absent).length;
  const lateCount = items.filter((i) => i.late).length;

  if (error) {
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
        right={
          <span className="text-[11px] text-[var(--muted)]">{saveState}</span>
        }
      />

      <p className="mb-3 text-sm text-[var(--muted)]">
        Rien coché = présent. Cochez seulement absents et retards.
      </p>

      {items.length > 0 ? (
        <p className="mb-3 text-sm text-[var(--text)]">
          {presentCount} présent{presentCount > 1 ? "s" : ""}
          {absentCount > 0
            ? ` · ${absentCount} absent${absentCount > 1 ? "s" : ""}`
            : ""}
          {lateCount > 0
            ? ` · ${lateCount} retard${lateCount > 1 ? "s" : ""}`
            : ""}
        </p>
      ) : null}

      {items.length === 0 && saveState !== "Chargement…" ? (
        <div className="surface px-4 py-5 text-sm text-[var(--muted)]">
          Aucun élève enregistré pour cette classe. La direction doit ajouter
          l’effectif dans Admin → Classes → Effectif (saisie ou import CSV/JSON).
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 border-b border-[var(--stroke)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <span>Élève</span>
            <span className="text-center">Absent</span>
            <span className="text-center">Retard</span>
          </div>
          <ul>
            {items.map((row) => (
              <li
                key={row.studentId}
                className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 border-b border-[var(--stroke)] px-3 py-2.5 last:border-b-0"
              >
                <span className="text-sm font-medium text-[var(--text)]">
                  {row.lastName} {row.firstName}
                </span>
                <label className="flex justify-center">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--danger)]"
                    checked={row.absent}
                    disabled={!canEdit}
                    onChange={() => toggle(row.studentId, "absent")}
                    aria-label={`${row.lastName} absent`}
                  />
                </label>
                <label className="flex justify-center">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--accent)]"
                    checked={row.late}
                    disabled={!canEdit || row.absent}
                    onChange={() => toggle(row.studentId, "late")}
                    aria-label={`${row.lastName} en retard`}
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <Link href={`/session/${id}/hub`} className="block">
          <Button className="w-full" variant="secondary">
            Retour au menu
          </Button>
        </Link>
      </div>
    </div>
  );
}
