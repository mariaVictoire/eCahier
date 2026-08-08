"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { buildLabeledSticker, printStickerImage } from "@/lib/qr-sticker";
import { cn } from "@/lib/utils";

type RoomInfo = {
  id: string;
  code: string;
  publicId: string;
  isActive: boolean;
  url: string;
};

type Classroom = {
  id: string;
  name: string;
  level: string | null;
  notes: string | null;
  studentsCount?: number;
  room: RoomInfo | null;
};

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  studentCode: string | null;
};

type TabId = "info" | "qr" | "students";

export function ClassDetail({ classroomId }: { classroomId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("info");
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterMsg, setRosterMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [stickerSrc, setStickerSrc] = useState("");
  const [qrBusy, setQrBusy] = useState(false);

  const buildQr = useCallback(async (c: Classroom) => {
    if (!c.room?.url) {
      setStickerSrc("");
      return;
    }
    setQrBusy(true);
    try {
      const QR = await import("qrcode");
      const qrDataUrl = await QR.toDataURL(c.room.url, {
        width: 320,
        margin: 1,
        color: { dark: "#004D2E", light: "#FFFFFF" },
      });
      const sticker = await buildLabeledSticker({
        qrDataUrl,
        title: c.name,
        code: c.room.code,
      });
      setStickerSrc(sticker);
    } catch {
      setStickerSrc("");
    } finally {
      setQrBusy(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    setRosterMsg("");
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/students`);
      const data = await res.json();
      if (!res.ok) {
        setRosterMsg(data.message || "Impossible de charger l’effectif");
        setStudents([]);
        return;
      }
      setStudents(data.items || []);
    } catch {
      setRosterMsg("Impossible de charger l’effectif");
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  }, [classroomId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/classrooms/${classroomId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Classe introuvable");
        setClassroom(null);
        return;
      }
      const c = data as Classroom;
      setClassroom(c);
      setEditName(c.name);
      setEditCode(c.room?.code || "");
      setEditNotes(c.notes || "");
      await buildQr(c);
    } catch {
      setError("Chargement impossible");
      setClassroom(null);
    } finally {
      setLoading(false);
    }
  }, [classroomId, buildQr]);

  useEffect(() => {
    load();
    loadStudents();
  }, [load, loadStudents]);

  async function saveClass(e: FormEvent) {
    e.preventDefault();
    setEditBusy(true);
    setError("");
    const res = await fetch(`/api/classrooms/${classroomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        code: editCode,
        notes: editNotes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setEditBusy(false);
    if (!res.ok) {
      setError(data.message || "Modification impossible");
      return;
    }
    await load();
  }

  async function deleteClass() {
    if (!classroom) return;
    if (!confirm(`Supprimer « ${classroom.name} » (QR + effectif) ?`)) {
      return;
    }
    const res = await fetch(`/api/classrooms/${classroom.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message || "Suppression impossible");
      return;
    }
    router.push("/admin/classes");
  }

  async function addStudent(e: FormEvent) {
    e.preventDefault();
    setRosterBusy(true);
    setRosterMsg("");
    const res = await fetch(`/api/classrooms/${classroomId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName }),
    });
    const data = await res.json().catch(() => ({}));
    setRosterBusy(false);
    if (!res.ok) {
      setRosterMsg(data.message || "Ajout impossible");
      return;
    }
    setFirstName("");
    setLastName("");
    await loadStudents();
  }

  async function importRoster() {
    if (!importText.trim()) return;
    setRosterBusy(true);
    setRosterMsg("");
    const res = await fetch(`/api/classrooms/${classroomId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: importText }),
    });
    const data = await res.json().catch(() => ({}));
    setRosterBusy(false);
    if (!res.ok) {
      setRosterMsg(data.message || "Import impossible");
      return;
    }
    setImportText("");
    setShowImport(false);
    setRosterMsg(`${data.count || 0} élève(s) ajouté(s)`);
    await loadStudents();
  }

  async function removeStudent(studentId: string) {
    if (!confirm("Retirer cet élève ?")) return;
    setRosterBusy(true);
    const res = await fetch(
      `/api/classrooms/${classroomId}/students?studentId=${studentId}`,
      { method: "DELETE" },
    );
    setRosterBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRosterMsg(data.message || "Suppression impossible");
      return;
    }
    await loadStudents();
  }

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.readAsText(file, "UTF-8");
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Chargement…</p>;
  }

  if (!classroom) {
    return (
      <div className="space-y-3">
        <Link
          href="/admin/classes"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="h-3.5 w-3.5"
          >
            <path
              d="M10 3.5 5.5 8 10 12.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Retour
        </Link>
        <p className="surface px-4 py-6 text-sm text-[var(--danger)]">
          {error || "Classe introuvable"}
        </p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; hint: string }[] = [
    { id: "info", label: "Informations", hint: "Fiche" },
    { id: "qr", label: "QR code", hint: "Accès salle" },
    {
      id: "students",
      label: "Élèves",
      hint: `${students.length} inscrit${students.length > 1 ? "s" : ""}`,
    },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/admin/classes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          className="h-3.5 w-3.5"
        >
          <path
            d="M10 3.5 5.5 8 10 12.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Retour
      </Link>

      <header className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--stroke)] bg-gradient-to-br from-[var(--brand-soft)] via-white to-[var(--accent-soft)] shadow-[var(--shadow-sm)]">
        <div className="border-b border-[var(--stroke)]/60 px-5 py-5 sm:px-6">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">
            Fiche classe
          </p>
          <h1 className="m-0 mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--brand-ink)]">
            {classroom.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {classroom.room ? (
              <span className="inline-flex items-center rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold text-[var(--brand-ink)] ring-1 ring-[var(--stroke)]">
                Code {classroom.room.code}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-md bg-white/80 px-2.5 py-1 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--stroke)]">
              {students.length} élève{students.length > 1 ? "s" : ""}
            </span>
            {classroom.level ? (
              <span className="inline-flex items-center rounded-md bg-white/80 px-2.5 py-1 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--stroke)]">
                {classroom.level}
              </span>
            ) : null}
          </div>
        </div>

        <nav
          className="grid grid-cols-3 gap-0 bg-white/70"
          aria-label="Sections de la classe"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative px-2 py-3.5 text-center transition sm:px-4",
                  active
                    ? "bg-white text-[var(--brand-ink)]"
                    : "text-[var(--muted)] hover:bg-white/80 hover:text-[var(--text)]",
                )}
              >
                <span
                  className={cn(
                    "block text-sm font-semibold sm:text-[15px]",
                    active && "text-[var(--brand)]",
                  )}
                >
                  {t.label}
                </span>
                <span className="mt-0.5 hidden text-[11px] sm:block">
                  {t.hint}
                </span>
                <span
                  className={cn(
                    "absolute inset-x-3 bottom-0 h-0.5 rounded-full transition",
                    active ? "bg-[var(--brand)]" : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </nav>
      </header>

      {error ? (
        <div className="rounded-[var(--radius)] border border-[var(--danger)]/30 bg-white px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {tab === "info" ? (
        <form
          onSubmit={saveClass}
          className="surface space-y-4 p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-base font-semibold text-[var(--brand-ink)]">
                Informations
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-[var(--danger)]"
              onClick={deleteClass}
            >
              Supprimer
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom" className="mb-0">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </Field>
            <Field label="Code (saisie / QR)" className="mb-0">
              <Input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                required
              />
            </Field>
          </div>
          <Field label="Commentaire" className="mb-0">
            <Input
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Bâtiment, étage…"
            />
          </Field>
          <Button type="submit" disabled={editBusy}>
            {editBusy ? "…" : "Enregistrer"}
          </Button>
        </form>
      ) : null}

      {tab === "qr" ? (
        <div className="surface p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="m-0 text-base font-semibold text-[var(--brand-ink)]">
              QR code de la classe
            </h2>
          </div>
          {!classroom.room ? (
            <p className="text-sm text-[var(--muted)]">
              Pas de QR lié à cette classe.
            </p>
          ) : qrBusy && !stickerSrc ? (
            <p className="text-sm text-[var(--muted)]">Génération du QR…</p>
          ) : stickerSrc ? (
            <div className="mx-auto max-w-sm">
              <div className="rounded-[var(--radius-lg)] bg-[var(--brand-soft)]/50 p-4 ring-1 ring-[var(--stroke)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stickerSrc}
                  alt={`QR ${classroom.name}`}
                  className="mx-auto w-full rounded-[12px] bg-white"
                />
              </div>
              <p className="mt-3 break-all text-center text-xs text-[var(--muted)]">
                {classroom.room.url}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  onClick={() => printStickerImage(stickerSrc, classroom.name)}
                >
                  Imprimer
                </Button>
                <a
                  href={stickerSrc}
                  download={`qr-${classroom.name.replace(/\s+/g, "-")}.png`}
                  className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[var(--stroke-strong)] bg-white px-4 text-[15px] font-semibold text-[var(--text)] hover:bg-[var(--bg)]"
                >
                  Télécharger
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--danger)]">
              Impossible de générer le QR.
            </p>
          )}
        </div>
      ) : null}

      {tab === "students" ? (
        <div className="surface p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-base font-semibold text-[var(--brand-ink)]">
                Élèves
              </h2>
              <p className="m-0 mt-1 text-sm text-[var(--muted)]">
                Effectif de la classe ({students.length}).
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? "Masquer import" : "Import CSV / JSON"}
            </Button>
          </div>

          {studentsLoading ? (
            <p className="text-sm text-[var(--muted)]">Chargement…</p>
          ) : students.length === 0 ? (
            <p className="mb-4 rounded-[var(--radius)] bg-[var(--bg)] px-4 py-6 text-center text-sm text-[var(--muted)]">
              Aucun élève pour l’instant.
            </p>
          ) : (
            <ul className="mb-4 max-h-72 divide-y divide-[var(--stroke)] overflow-y-auto rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--bg)]/40">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 bg-white/80 px-3.5 py-2.5 text-sm"
                >
                  <span className="font-medium text-[var(--text)]">
                    {s.lastName}{" "}
                    <span className="font-normal text-[var(--muted)]">
                      {s.firstName}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[var(--danger)] hover:underline"
                    disabled={rosterBusy}
                    onClick={() => removeStudent(s.id)}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={addStudent}
            className="grid gap-3 rounded-[var(--radius)] border border-dashed border-[var(--stroke-strong)] bg-[var(--bg)]/50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
          >
            <Field label="Nom" className="mb-0">
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </Field>
            <Field label="Prénom" className="mb-0">
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </Field>
            <div>
              <span
                className="mb-1.5 block text-[13px] font-medium text-transparent select-none"
                aria-hidden
              >
                Ajouter
              </span>
              <Button type="submit" disabled={rosterBusy} className="w-full sm:w-auto">
                Ajouter
              </Button>
            </div>
          </form>

          {showImport ? (
            <div className="mt-4 border-t border-[var(--stroke)] pt-4">
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={4}
                placeholder={"nom,prenom\nMba,Jean\nNzue,Aline"}
                className="mb-2 font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.json,.txt,text/csv,application/json"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  Fichier
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={rosterBusy || !importText.trim()}
                  onClick={importRoster}
                >
                  Importer
                </Button>
              </div>
            </div>
          ) : null}

          {rosterMsg ? (
            <p className="mt-3 text-sm font-medium text-[var(--brand-ink)]">
              {rosterMsg}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
