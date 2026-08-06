"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, Field, PageTitle, Select, Textarea } from "@/components/ui";
import { CLASS_LEVELS } from "@/lib/classrooms";

type Classroom = {
  id: string;
  name: string;
  level: string | null;
  notes: string | null;
};

export function ClassesManager() {
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
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setError(data.message || "Chargement impossible");
        return;
      }
      setItems(data.items || []);
      setYearLabel(data.schoolYear?.label || "");
    } catch {
      setError("Chargement impossible");
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
          if (!c.name.startsWith(prefix) || c.name.length !== prefix.length + 1) {
            return null;
          }
          return c.name.slice(prefix.length).toUpperCase();
        })
        .filter(Boolean),
    );
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let next = "?";
    for (const L of letters) {
      if (!used.has(L)) {
        next = L;
        break;
      }
    }
    setPreviewLetter(next);
  }, [items, level]);

  async function onSubmit(e: FormEvent) {
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
    await load();
  }

  const grouped = CLASS_LEVELS.map((lvl) => ({
    level: lvl,
    classes: items.filter((c) => c.level === lvl),
  })).filter((g) => g.classes.length > 0);

  const other = items.filter(
    (c) => !c.level || !(CLASS_LEVELS as readonly string[]).includes(c.level),
  );

  return (
    <div>
      <PageTitle
        title="Classes"
        subtitle={
          yearLabel
            ? `Année ${yearLabel} — choisissez le niveau, la lettre (A, B, C…) est attribuée automatiquement.`
            : "Choisissez le niveau ; la lettre est attribuée automatiquement."
        }
      />

      <form
        onSubmit={onSubmit}
        className="surface mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
      >
        <Field label="Niveau">
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
        <Field label="Commentaire (optionnel)">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex. bâtiment A, près du CDI…"
            className="min-h-[44px] resize-y"
            rows={1}
          />
        </Field>
        <div className="flex flex-col gap-2 sm:pb-0.5">
          <p className="text-sm text-[var(--muted)]">
            Sera créée :{" "}
            <span className="font-semibold text-[var(--brand-ink)]">
              {level} {previewLetter}
            </span>
          </p>
          <Button type="submit" disabled={saving || previewLetter === "?"}>
            {saving ? "Création…" : "Ajouter la classe"}
          </Button>
        </div>
      </form>

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="surface px-4 py-8 text-center text-sm text-[var(--muted)]">
          Aucune classe. Ajoutez la première (ex. 6ème → 6ème A).
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <section key={g.level} className="surface overflow-hidden">
              <h2 className="border-b border-[var(--stroke)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)]">
                {g.level}
              </h2>
              <ul className="divide-y divide-[var(--stroke)]">
                {g.classes.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.notes ? (
                      <span className="text-sm text-[var(--muted)]">
                        {c.notes}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {other.length > 0 ? (
            <section className="surface overflow-hidden">
              <h2 className="border-b border-[var(--stroke)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)]">
                Autres
              </h2>
              <ul className="divide-y divide-[var(--stroke)]">
                {other.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[var(--muted)]">
                      {c.notes || c.level || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
