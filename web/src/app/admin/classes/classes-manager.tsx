"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field, Input, PageTitle, Select } from "@/components/ui";
import { CLASS_LEVELS } from "@/lib/classrooms";

type Classroom = {
  id: string;
  name: string;
  level: string | null;
  notes: string | null;
  studentsCount?: number;
  room: { code: string } | null;
};

export function ClassesManager() {
  const router = useRouter();
  const [items, setItems] = useState<Classroom[]>([]);
  const [yearLabel, setYearLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [level, setLevel] = useState<string>(CLASS_LEVELS[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewLetter, setPreviewLetter] = useState("A");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/classrooms");
      const text = await res.text();
      let data: {
        message?: string;
        items?: Classroom[];
        schoolYear?: { label?: string };
      } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(
          "Réponse serveur invalide. Rechargez la page ou reconnectez-vous.",
        );
        setItems([]);
        return;
      }
      if (!res.ok) {
        setError(
          data.message ||
            (res.status === 401
              ? "Session expirée — reconnectez-vous (admin@lycee.ga)."
              : "Chargement impossible"),
        );
        setItems([]);
        return;
      }
      setItems(data.items || []);
      setYearLabel(data.schoolYear?.label || "");
    } catch {
      setError(
        "Chargement impossible. Vérifiez votre connexion, puis reconnectez-vous si besoin.",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const used = new Set(
      items
        .filter((c) => c.level === level)
        .map((c) => {
          const prefix = `${level} `;
          if (
            !c.name.startsWith(prefix) ||
            c.name.length !== prefix.length + 1
          ) {
            return null;
          }
          return c.name.slice(prefix.length).toUpperCase();
        })
        .filter(Boolean),
    );
    let next = "?";
    for (const L of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      if (!used.has(L)) {
        next = L;
        break;
      }
    }
    setPreviewLetter(next);
  }, [items, level]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/classrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, notes }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Création impossible");
      return;
    }
    setNotes("");
    if (data.id) {
      router.push(`/admin/classes/${data.id}`);
      return;
    }
    await load();
  }

  return (
    <div>
      <PageTitle
        title="Classes & QR"
        subtitle={yearLabel ? `Année ${yearLabel}` : undefined}
      />

      <form
        onSubmit={onCreate}
        className="surface mb-4 space-y-4 p-4 sm:p-5"
      >
        <div>
          <h2 className="m-0 text-base font-semibold text-[var(--brand-ink)]">
            Nouvelle classe
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Niveau" className="mb-0">
            <Select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              required
            >
              {CLASS_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Commentaire (optionnel)" className="mb-0">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bâtiment, étage…"
            />
          </Field>
        </div>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={saving || previewLetter === "?"}
        >
          {saving ? "…" : `Créer ${level} ${previewLetter}`}
        </Button>
      </form>

      {error ? (
        <div className="surface mb-3 border border-[var(--danger)]/30 bg-white px-4 py-3 text-sm text-[var(--danger)]">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-[var(--brand)] underline"
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Se reconnecter
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : items.length === 0 && !error ? (
        <p className="surface px-4 py-8 text-center text-sm text-[var(--muted)]">
          Aucune classe. Créez la première ci-dessus.
        </p>
      ) : items.length === 0 ? null : (
        <div className="surface overflow-hidden">
          <p className="border-b border-[var(--stroke)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Classes ({items.length})
          </p>
          <ul className="divide-y divide-[var(--stroke)]">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/classes/${c.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-[var(--bg)]"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text)]">
                      {c.name}
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      {c.room?.code ? `${c.room.code} · ` : ""}
                      {c.studentsCount ?? 0} élève
                      {(c.studentsCount ?? 0) > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-[var(--brand)]">
                    Ouvrir
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
