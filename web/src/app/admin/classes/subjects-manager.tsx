"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, Field, Input, PageTitle } from "@/components/ui";

type Subject = {
  id: string;
  name: string;
  code: string;
};

export function SubjectsManager() {
  const [items, setItems] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/subjects");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Chargement impossible");
        setItems([]);
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("Chargement impossible");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        code: code.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok && res.status !== 409) {
      setError(data.message || "Création impossible");
      return;
    }
    if (res.status === 409 && !data.item) {
      setError(data.message || "Cette matière existe déjà");
      return;
    }
    setName("");
    setCode("");
    await load();
  }

  function startEdit(s: Subject) {
    setEditId(s.id);
    setEditName(s.name);
    setEditCode(s.code);
    setError("");
  }

  function cancelEdit() {
    setEditId(null);
    setEditName("");
    setEditCode("");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditBusy(true);
    setError("");
    const res = await fetch(`/api/subjects/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, code: editCode }),
    });
    const data = await res.json().catch(() => ({}));
    setEditBusy(false);
    if (!res.ok) {
      setError(data.message || "Modification impossible");
      return;
    }
    cancelEdit();
    await load();
  }

  async function removeSubject(s: Subject) {
    if (!confirm(`Supprimer la matière « ${s.name} » ?`)) return;
    setError("");
    const res = await fetch(`/api/subjects/${s.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message || "Suppression impossible");
      return;
    }
    if (editId === s.id) cancelEdit();
    await load();
  }

  return (
    <section>
      <PageTitle title="Matières" />

      <form
        onSubmit={onCreate}
        className="surface mb-4 space-y-4 p-4 sm:p-5"
      >
        <h2 className="m-0 text-base font-semibold text-[var(--brand-ink)]">
          Nouvelle matière
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom" className="mb-0">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Histoire-Géo"
              required
            />
          </Field>
          <Field label="Code (optionnel)" className="mb-0">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Auto si vide"
            />
          </Field>
        </div>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          disabled={saving || !name.trim()}
        >
          {saving ? "…" : "Ajouter"}
        </Button>
      </form>

      {error ? (
        <div className="surface mb-3 border border-[var(--danger)]/30 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="surface px-4 py-8 text-center text-sm text-[var(--muted)]">
          Aucune matière pour le moment.
        </p>
      ) : (
        <div className="surface overflow-hidden">
          <p className="border-b border-[var(--stroke)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Référentiel ({items.length})
          </p>
          <ul className="divide-y divide-[var(--stroke)]">
            {items.map((s) => (
              <li key={s.id} className="px-4 py-3">
                {editId === s.id ? (
                  <form
                    onSubmit={saveEdit}
                    className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
                  >
                    <Field label="Nom" className="mb-0">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="Code" className="mb-0">
                      <Input
                        value={editCode}
                        onChange={(e) =>
                          setEditCode(e.target.value.toUpperCase())
                        }
                        required
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" disabled={editBusy}>
                        {editBusy ? "…" : "OK"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={cancelEdit}
                      >
                        Annuler
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="block text-sm font-semibold text-[var(--text)]">
                        {s.name}
                      </span>
                      <span className="block text-xs text-[var(--muted)]">
                        {s.code}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(s)}
                      >
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[var(--danger)]"
                        onClick={() => removeSubject(s)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
