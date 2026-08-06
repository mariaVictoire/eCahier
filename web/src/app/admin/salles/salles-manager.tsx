"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button, Field, PageTitle, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CLASS_LEVELS } from "@/lib/classrooms";
import { buildLabeledSticker, printStickerImage } from "@/lib/qr-sticker";
import { RoomQrCard } from "./room-qr-card";

type RoomItem = {
  id: string;
  code: string;
  label: string;
  building: string | null;
  publicId: string;
  url: string;
  isActive: boolean;
};

type ClassroomOpt = {
  id: string;
  name: string;
  level: string | null;
};

type CreatedQr = RoomItem & {
  qrDataUrl: string;
  stickerSrc: string;
};

type Mode = "ajouter" | "consulter";

export function SallesManager() {
  const [mode, setMode] = useState<Mode>("consulter");
  const [items, setItems] = useState<RoomItem[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [level, setLevel] = useState<string>(CLASS_LEVELS[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedQr | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const previewName = useMemo(() => {
    const used = new Set(
      classrooms
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
    for (const L of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      if (!used.has(L)) return `${level} ${L}`;
    }
    return `${level} ?`;
  }, [classrooms, level]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setError(data.message || "Chargement impossible");
        return;
      }
      setItems(data.items || []);
      setClassrooms(data.classrooms || []);
    } catch {
      setError("Chargement impossible");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/rooms", {
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

    const title = data.label || data.classroomName;
    const subtitle = data.building
      ? `${data.code} · ${data.building}`
      : data.code;

    let stickerSrc = data.qrDataUrl as string;
    try {
      stickerSrc = await buildLabeledSticker({
        qrDataUrl: data.qrDataUrl,
        title,
        subtitle,
      });
    } catch {
      // QR brut
    }

    setCreated({
      id: data.id,
      code: data.code,
      label: title,
      building: data.building,
      publicId: data.publicId,
      url: data.url,
      isActive: true,
      qrDataUrl: data.qrDataUrl,
      stickerSrc,
    });
    setHighlightId(data.id);
    setNotes("");
    await load({ silent: true });
    setMode("consulter");
  }

  async function toggleActive(id: string, next: boolean) {
    const res = await fetch(`/api/rooms/item/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Mise à jour impossible");
      return;
    }
    await load({ silent: true });
  }

  async function deleteRoom(id: string) {
    const res = await fetch(`/api/rooms/item/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Suppression impossible");
      return;
    }
    await load({ silent: true });
  }

  return (
    <div>
      <PageTitle title="Salles & QR" />

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-[14px] bg-[var(--brand-soft)] p-1.5">
        <button
          type="button"
          onClick={() => setMode("ajouter")}
          className={cn(
            "rounded-[10px] px-3 py-3 text-center transition",
            mode === "ajouter"
              ? "bg-white text-[var(--brand-ink)] shadow-[var(--shadow-sm)]"
              : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
        >
          <span className="block text-base font-semibold">
            Ajouter une classe
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("consulter")}
          className={cn(
            "rounded-[10px] px-3 py-3 text-center transition",
            mode === "consulter"
              ? "bg-white text-[var(--brand-ink)] shadow-[var(--shadow-sm)]"
              : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
        >
          <span className="block text-base font-semibold">
            Consulter les QR
          </span>
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {mode === "ajouter" ? (
        <form onSubmit={onSubmit} className="surface mx-auto max-w-lg space-y-1 p-5">
          <h2 className="font-[family-name:var(--font-sans)] text-xl font-semibold text-[var(--brand-ink)]">
            Nouvelle classe + QR
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
            Sélectionnez le niveau. La lettre suivante est attribuée
            automatiquement (ex. 6ème A, puis 6ème B…).
          </p>
          <Field label="Niveau">
            <Select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              required
              className="font-[family-name:var(--font-sans)] text-lg"
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
              placeholder="ex. Bloc B, près du CDI…"
              className="min-h-[72px]"
              rows={2}
            />
          </Field>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Sera créée :{" "}
            <span className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--brand-ink)]">
              {previewName}
            </span>
          </p>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={saving || previewName.endsWith("?")}
          >
            {saving ? "Création…" : "Créer la classe et le QR"}
          </Button>
        </form>
      ) : loading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="surface px-4 py-10 text-center">
          <p className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--brand-ink)]">
            Aucun QR pour l’instant
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ajoutez une classe (ex. 6ème) pour générer le premier QR.
          </p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => setMode("ajouter")}
          >
            Ajouter une classe
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((room) => (
            <RoomQrCard
              key={room.id}
              id={room.id}
              code={room.code}
              label={room.label}
              building={room.building}
              publicId={room.publicId}
              url={room.url}
              isActive={room.isActive}
              highlight={highlightId === room.id}
              onToggleActive={toggleActive}
              onDelete={deleteRoom}
            />
          ))}
        </div>
      )}

      {created ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
              Classe + QR créés
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-sans)] text-2xl font-semibold text-[var(--brand-ink)]">
              {created.label}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {created.building
                ? created.building
                : "Étiquette prête à imprimer pour la porte."}
            </p>
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={created.stickerSrc}
                alt={`QR ${created.label}`}
                className="w-full max-w-[280px] rounded-[14px] border border-[var(--stroke)]"
              />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                onClick={() =>
                  printStickerImage(created.stickerSrc, created.label)
                }
              >
                Imprimer
              </Button>
              <a
                href={created.stickerSrc}
                download={`etiquette-qr-${created.label.replace(/\s+/g, "-")}.png`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-strong)] bg-white px-4 text-[15px] font-semibold text-[var(--text)] hover:bg-[var(--bg)]"
              >
                Télécharger
              </a>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => setCreated(null)}
            >
              Voir tous les QR
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
