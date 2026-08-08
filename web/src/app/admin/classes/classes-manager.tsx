"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authExpired, setAuthExpired] = useState(false);
  const [level, setLevel] = useState<string>(CLASS_LEVELS[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewLetter, setPreviewLetter] = useState("A");

  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setAuthExpired(false);
    try {
      const res = await fetch("/api/classrooms");
      const text = await res.text();
      let data: {
        message?: string;
        code?: string;
        items?: Classroom[];
      } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError("Réponse serveur invalide. Réessayez dans un instant.");
        setItems([]);
        return;
      }
      if (!res.ok) {
        const needsReconnect =
          res.status === 401 ||
          data.code === "NO_SESSION" ||
          data.code === "USER_NOT_FOUND" ||
          data.code === "SCHOOL_NOT_FOUND";
        setAuthExpired(needsReconnect);
        setError(
          data.message ||
            (needsReconnect
              ? "Session expirée — reconnectez-vous."
              : "Chargement impossible"),
        );
        setItems([]);
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("Chargement impossible. Vérifiez votre connexion puis réessayez.");
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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => {
      const hay = `${c.name} ${c.room?.code || ""} ${c.level || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

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

  async function deleteClass(c: Classroom) {
    if (!confirm(`Supprimer « ${c.name} » (QR + effectif) ?`)) return;
    setError("");
    const res = await fetch(`/api/classrooms/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Suppression impossible");
      return;
    }
    if (query.trim().toLowerCase() === c.name.toLowerCase()) {
      setQuery("");
    }
    await load();
  }

  function openClass(c: Classroom) {
    setQuery(c.name);
    setPickerOpen(false);
    router.push(`/admin/classes/${c.id}`);
  }

  return (
    <div>
      <PageTitle title="Classes & QR" />

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
          {saving ? "…" : "Créer"}
        </Button>
      </form>

      {error ? (
        <div className="surface mb-3 border border-[var(--danger)]/30 bg-white px-4 py-3 text-sm text-[var(--danger)]">
          <p className="font-medium">{error}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-[var(--brand)] underline"
              onClick={() => load()}
            >
              Réessayer
            </button>
            {authExpired ? (
              <button
                type="button"
                className="text-sm font-semibold text-[var(--brand)] underline"
                onClick={() => {
                  window.location.href = "/login";
                }}
              >
                Se reconnecter
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : items.length === 0 && !error ? (
        <p className="surface px-4 py-8 text-center text-sm text-[var(--muted)]">
          Aucune classe. Créez la première ci-dessus.
        </p>
      ) : items.length === 0 ? null : (
        <div className="surface space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="m-0 text-base font-semibold text-[var(--brand-ink)]">
              Classes ({items.length})
            </h2>
          </div>

          <div ref={pickerRef} className="relative">
            <Field label="Rechercher une classe" className="mb-0">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                autoComplete="off"
                aria-expanded={pickerOpen}
                aria-controls="class-picker-list"
              />
            </Field>
            {pickerOpen ? (
              <ul
                id="class-picker-list"
                role="listbox"
                className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-[10px] border border-[var(--stroke)] bg-white shadow-sm"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-[var(--muted)]">
                    Aucune classe trouvée
                  </li>
                ) : (
                  filtered.map((c) => (
                    <li
                      key={c.id}
                      role="option"
                      className="flex items-center gap-1 border-b border-[var(--stroke)] last:border-b-0"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 px-3 py-2.5 text-left transition hover:bg-[var(--bg)]"
                        onClick={() => openClass(c)}
                      >
                        <span className="block text-sm font-semibold text-[var(--text)]">
                          {c.name}
                        </span>
                        <span className="block text-xs text-[var(--muted)]">
                          {c.room?.code ? `${c.room.code} · ` : ""}
                          {c.studentsCount ?? 0} élève
                          {(c.studentsCount ?? 0) > 1 ? "s" : ""}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--danger)] transition hover:bg-red-50"
                        title="Supprimer"
                        aria-label={`Supprimer ${c.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteClass(c);
                        }}
                      >
                        <IconTrash />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4h8v2M9 10v8M12 10v8M15 10v8M6 6l1 14h10l1-14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
