"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Field,
  Input,
  PageTitle,
  Select,
  Textarea,
} from "@/components/ui";
import {
  addDays,
  dateForWeekday,
  formatWeekRange,
  monthValue,
  parseDateKey,
  parseMonthValue,
  startOfWeekMonday,
  toDateKey,
  weeksInMonth,
} from "@/lib/calendar";
import { formatHmFr } from "@/lib/datetime";

const DAY_LABEL: Record<string, string> = {
  mon: "Lun",
  tue: "Mar",
  wed: "Mer",
  thu: "Jeu",
  fri: "Ven",
  sat: "Sam",
};

const DAY_FULL: Record<string, string> = {
  mon: "Lundi",
  tue: "Mardi",
  wed: "Mercredi",
  thu: "Jeudi",
  fri: "Vendredi",
  sat: "Samedi",
};

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

type Entity = {
  id: string;
  name?: string;
  code?: string;
  label?: string;
  homeClassroomId?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string | null;
};

type Slot = {
  id: string;
  weekday: string;
  startsAt: string;
  endsAt: string;
  roomId: string;
  classroomId: string;
  subjectId: string;
  teacherId: string;
  room: { id: string; code: string; label: string };
  classroom: { id: string; name: string };
  subject: { id: string; name: string; code: string };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
};

type Meta = {
  classrooms: Entity[];
  rooms: Entity[];
  subjects: Entity[];
  teachers: Entity[];
};

type FormState = {
  id?: string;
  weekday: string;
  startsAt: string;
  endsAt: string;
  roomId: string;
  classroomId: string;
  subjectId: string;
  teacherId: string;
};

const emptyForm = (classroomId = ""): FormState => ({
  weekday: "mon",
  startsAt: "08:00",
  endsAt: "09:00",
  roomId: "",
  classroomId,
  subjectId: "",
  teacherId: "",
});

function initialPeriod() {
  const today = new Date();
  const weekStart = startOfWeekMonday(today);
  return {
    month: monthValue(today),
    weekStartKey: toDateKey(weekStart),
  };
}

const MONTH_OPTIONS = (() => {
  const base = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = -8; i <= 16; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const label = d.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
    options.push({
      value: monthValue(d),
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
  }
  return options;
})();

function isToday(d: Date) {
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export default function EdtPage() {
  const initial = useMemo(() => initialPeriod(), []);
  const [classroomId, setClassroomId] = useState("");
  const [month, setMonth] = useState(initial.month);
  const [weekStartKey, setWeekStartKey] = useState(initial.weekStartKey);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);
  const [subjectMsg, setSubjectMsg] = useState("");
  const [csv, setCsv] = useState(
    "weekday;startsAt;endsAt;roomCode;classroom;subjectCode;teacherEmail\nlundi;08:00;09:00;3A;3ème A;MATH;obame@lycee.ga",
  );
  const [importMsg, setImportMsg] = useState("");

  const weekOptions = useMemo(() => {
    const { year, month: m } = parseMonthValue(month);
    return weeksInMonth(year, m);
  }, [month]);

  useEffect(() => {
    if (weekOptions.length === 0) return;
    if (!weekOptions.some((w) => w.weekStartKey === weekStartKey)) {
      const todayKey = toDateKey(startOfWeekMonday(new Date()));
      const match = weekOptions.find((w) => w.weekStartKey === todayKey);
      setWeekStartKey(match?.weekStartKey || weekOptions[0].weekStartKey);
    }
  }, [weekOptions, weekStartKey]);

  const weekStartDate = useMemo(
    () => parseDateKey(weekStartKey),
    [weekStartKey],
  );

  const selectedWeekLabel = useMemo(() => {
    const found = weekOptions.find((w) => w.weekStartKey === weekStartKey);
    if (found) return found.label;
    const end = addDays(weekStartDate, 6);
    return formatWeekRange(weekStartDate, end);
  }, [weekOptions, weekStartKey, weekStartDate]);

  const load = useCallback(async (classFilter: string, weekKey: string) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (classFilter) params.set("classroomId", classFilter);
    if (weekKey) params.set("weekStart", weekKey);
    const qs = params.toString() ? `?${params}` : "";
    const res = await fetch(`/api/timetable${qs}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Impossible de charger l’EDT");
      return;
    }
    setSlots(data.slots);
    setMeta(data.meta);
  }, []);

  useEffect(() => {
    load(classroomId, weekStartKey);
  }, [classroomId, weekStartKey, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const d of DAYS) map.set(d, []);
    for (const s of slots) {
      if (!map.has(s.weekday)) map.set(s.weekday, []);
      map.get(s.weekday)!.push(s);
    }
    for (const d of DAYS) {
      map.get(d)!.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [slots]);

  /** Lignes horaires du tableau EDT (dérivées des créneaux, sinon plages types). */
  const timeRows = useMemo(() => {
    const keys = new Map<string, { startsAt: string; endsAt: string }>();
    for (const s of slots) {
      const k = `${s.startsAt}|${s.endsAt}`;
      if (!keys.has(k)) keys.set(k, { startsAt: s.startsAt, endsAt: s.endsAt });
    }
    if (keys.size === 0) {
      return [
        { startsAt: "07:30", endsAt: "08:30" },
        { startsAt: "08:30", endsAt: "09:30" },
        { startsAt: "09:45", endsAt: "10:45" },
        { startsAt: "10:45", endsAt: "11:45" },
        { startsAt: "14:00", endsAt: "15:00" },
        { startsAt: "15:00", endsAt: "16:00" },
      ];
    }
    return Array.from(keys.values()).sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
  }, [slots]);

  function slotsAt(day: string, startsAt: string, endsAt: string) {
    return (grouped.get(day) || []).filter(
      (s) => s.startsAt === startsAt && s.endsAt === endsAt,
    );
  }

  function roomIdForClassroom(classId: string) {
    const linked = meta?.rooms.find((r) => r.homeClassroomId === classId);
    if (linked) return linked.id;
    return meta?.rooms[0]?.id || "";
  }

  function openCreate(
    weekday?: string,
    startsAt?: string,
    endsAt?: string,
  ) {
    const classId = classroomId || meta?.classrooms[0]?.id || "";
    const base = emptyForm(classId);
    setForm({
      ...base,
      weekday: weekday || "mon",
      startsAt: startsAt || base.startsAt,
      endsAt: endsAt || base.endsAt,
      roomId: roomIdForClassroom(classId),
      subjectId: meta?.subjects[0]?.id || "",
      teacherId: meta?.teachers[0]?.id || "",
      classroomId: classId,
    });
  }

  function openEdit(slot: Slot) {
    setForm({
      id: slot.id,
      weekday: slot.weekday,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      roomId: slot.roomId,
      classroomId: slot.classroomId,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
    });
  }

  async function saveSlot(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    const res = await fetch(
      form.id ? `/api/timetable/${form.id}` : "/api/timetable",
      {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      },
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Enregistrement impossible");
      return;
    }
    setForm(null);
    await load(classroomId, weekStartKey);
  }

  async function removeSlot(id: string) {
    if (!confirm("Supprimer ce créneau ?")) return;
    const res = await fetch(`/api/timetable/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Suppression impossible");
      return;
    }
    await load(classroomId, weekStartKey);
  }

  async function createSubject(fromForm = false) {
    const name = newSubjectName.trim();
    if (!name) {
      setSubjectMsg("Indiquez le nom de la matière");
      return;
    }
    setAddingSubject(true);
    setSubjectMsg("");
    const res = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setAddingSubject(false);
    if (!res.ok && res.status !== 409) {
      setSubjectMsg(data.message || "Création impossible");
      return;
    }
    const item = data.item || data;
    setMeta((m) => {
      if (!m) return m;
      const exists = m.subjects.some((s) => s.id === item.id);
      return {
        ...m,
        subjects: exists
          ? m.subjects
          : [...m.subjects, { id: item.id, name: item.name, code: item.code }],
      };
    });
    if (fromForm && form) {
      setForm({ ...form, subjectId: item.id });
    }
    setNewSubjectName("");
    setSubjectMsg(`Matière « ${item.name} » ajoutée`);
  }

  async function importCsv(e: FormEvent) {
    e.preventDefault();
    setImportMsg("");
    const res = await fetch("/api/timetable/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv,
        replaceClassroomId: classroomId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setImportMsg(data.message || "Import échoué");
      return;
    }
    setImportMsg(
      `${data.created} créneau(x) importé(s)` +
        (data.errors?.length ? ` · ${data.errors.length} erreur(s)` : ""),
    );
    if (data.errors?.length) {
      setImportMsg((m) => `${m}\n${data.errors.slice(0, 5).join("\n")}`);
    }
    await load(classroomId, weekStartKey);
  }

  return (
    <div>
      <PageTitle
        title="Emploi du temps"
        action={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSubjectMsg("");
                setSubjectsOpen(true);
              }}
            >
              Matières
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              Importer
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openCreate()}
            >
              Nouveau créneau
            </Button>
          </>
        }
      />

      {/* Filtres */}
      <div className="surface mb-4 space-y-2 p-3">
        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          <label className="min-w-[120px] flex-1">
            <span className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
              Classe
            </span>
            <select
              className="h-9 w-full rounded-lg border border-[var(--stroke)] bg-white px-2.5 text-sm outline-none focus:border-[var(--brand)]"
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
            >
              <option value="">Toutes</option>
              {meta?.classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[120px] flex-1">
            <span className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
              Mois
            </span>
            <select
              className="h-9 w-full rounded-lg border border-[var(--stroke)] bg-white px-2.5 text-sm outline-none focus:border-[var(--brand)]"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block w-full">
          <span className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
            Semaine
          </span>
          <select
            className="h-9 w-full rounded-lg border border-[var(--stroke)] bg-white px-2.5 text-sm outline-none focus:border-[var(--brand)]"
            value={weekStartKey}
            onChange={(e) => setWeekStartKey(e.target.value)}
          >
            {weekOptions.map((w) => (
              <option key={w.weekStartKey} value={w.weekStartKey}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">
          Chargement de la semaine…
        </p>
      ) : (
        <>
          {/* Tableau EDT semaine */}
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[var(--brand-ink)] text-white">
                  <th className="sticky left-0 z-10 w-24 bg-[var(--brand-ink)] px-3 py-3 text-xs font-semibold uppercase tracking-wide">
                    Horaire
                  </th>
                  {DAYS.map((day) => {
                    const dayDate = dateForWeekday(weekStartDate, day);
                    const today = isToday(dayDate);
                    return (
                      <th
                        key={day}
                        className={
                          today
                            ? "px-2 py-3 text-center"
                            : "px-2 py-3 text-center font-medium"
                        }
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                          {DAY_LABEL[day]}
                        </div>
                        <div
                          className={
                            today
                              ? "mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-sm font-bold text-[var(--brand-ink)]"
                              : "mt-0.5 text-base font-semibold"
                          }
                        >
                          {dayDate.getDate()}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeRows.map((row, rowIdx) => (
                  <tr
                    key={`${row.startsAt}-${row.endsAt}`}
                    className={
                      rowIdx % 2 === 0 ? "bg-white" : "bg-[var(--bg)]/60"
                    }
                  >
                    <th className="sticky left-0 z-10 border-b border-r border-[var(--stroke)] bg-inherit px-3 py-3 align-middle">
                        <div className="tabular-nums text-[13px] font-semibold text-[var(--brand-ink)]">
                          {formatHmFr(row.startsAt)}
                        </div>
                        <div className="tabular-nums text-[11px] text-[var(--muted)]">
                          {formatHmFr(row.endsAt)}
                        </div>
                    </th>
                    {DAYS.map((day) => {
                      const cellSlots = slotsAt(day, row.startsAt, row.endsAt);
                      return (
                        <td
                          key={day}
                          className="border-b border-[var(--stroke)] p-1.5 align-top"
                        >
                          {cellSlots.length === 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                openCreate(day, row.startsAt, row.endsAt)
                              }
                              className="flex min-h-[72px] w-full items-center justify-center rounded-lg border border-dashed border-transparent text-[var(--muted)] hover:border-[var(--stroke-strong)] hover:bg-white hover:text-[var(--brand)]"
                              title={`Ajouter · ${DAY_FULL[day]} ${formatHmFr(row.startsAt)}`}
                            >
                              +
                            </button>
                          ) : (
                            <div className="space-y-1">
                              {cellSlots.map((s) => (
                                <div
                                  key={s.id}
                                  className="group relative rounded-lg border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-2 py-1.5"
                                >
                                  <p className="truncate text-[13px] font-semibold leading-tight text-[var(--brand-ink)]">
                                    {s.subject.name}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                                    {s.classroom.name} · {s.room.code}
                                  </p>
                                  <p className="truncate text-[11px] text-[var(--muted)]">
                                    {s.teacher.firstName} {s.teacher.lastName}
                                  </p>
                                  <div className="absolute right-1 top-1 flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                    <button
                                      type="button"
                                      title="Modifier"
                                      aria-label="Modifier"
                                      onClick={() => openEdit(s)}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded bg-white text-[var(--brand-ink)] shadow-sm"
                                    >
                                      <IconEdit />
                                    </button>
                                    <button
                                      type="button"
                                      title="Supprimer"
                                      aria-label="Supprimer"
                                      onClick={() => removeSlot(s.id)}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded bg-white text-[var(--danger)] shadow-sm"
                                    >
                                      <IconTrash />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {form ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={saveSlot}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5"
          >
            <h2 className="text-xl font-semibold text-[var(--brand-ink)]">
              {form.id ? "Modifier le créneau" : "Nouveau créneau"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Créneau type de la semaine ({selectedWeekLabel.toLowerCase()}).
            </p>
            <div className="mt-4 space-y-1">
              <Field label="Jour">
                <Select
                  value={form.weekday}
                  onChange={(e) =>
                    setForm({ ...form, weekday: e.target.value })
                  }
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {DAY_FULL[d]} —{" "}
                      {dateForWeekday(weekStartDate, d).toLocaleDateString(
                        "fr-FR",
                      )}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Début">
                  <Input
                    type="time"
                    value={form.startsAt}
                    onChange={(e) =>
                      setForm({ ...form, startsAt: e.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Fin">
                  <Input
                    type="time"
                    value={form.endsAt}
                    onChange={(e) =>
                      setForm({ ...form, endsAt: e.target.value })
                    }
                    required
                  />
                </Field>
              </div>
              <Field label="Classe">
                <Select
                  value={form.classroomId}
                  onChange={(e) => {
                    const nextClassId = e.target.value;
                    setForm({
                      ...form,
                      classroomId: nextClassId,
                      roomId: roomIdForClassroom(nextClassId),
                    });
                  }}
                  required
                >
                  {meta?.classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Salle">
                <Select
                  value={form.roomId}
                  onChange={(e) =>
                    setForm({ ...form, roomId: e.target.value })
                  }
                  required
                >
                  {meta?.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || `${r.code} · ${r.label}`}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Classe : Terminale C · Code salle : TC (initiale + lettre).
                </p>
              </Field>
              <Field label="Matière">
                <Select
                  value={form.subjectId}
                  onChange={(e) =>
                    setForm({ ...form, subjectId: e.target.value })
                  }
                  required
                >
                  {meta?.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Nouvelle matière…"
                    className="h-9 text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={addingSubject || !newSubjectName.trim()}
                    onClick={() => createSubject(true)}
                  >
                    Ajouter
                  </Button>
                </div>
              </Field>
              <Field label="Enseignant">
                <Select
                  value={form.teacherId}
                  onChange={(e) =>
                    setForm({ ...form, teacherId: e.target.value })
                  }
                  required
                >
                  {meta?.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {error ? (
              <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setForm(null)}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {subjectsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5">
            <h2 className="text-xl font-semibold text-[var(--brand-ink)]">
              Matières
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Ajoutez les disciplines utilisées dans l’emploi du temps.
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="ex. Histoire-Géo"
              />
              <Button
                type="button"
                disabled={addingSubject || !newSubjectName.trim()}
                onClick={() => createSubject(false)}
              >
                {addingSubject ? "…" : "Ajouter"}
              </Button>
            </div>
            {subjectMsg ? (
              <p className="mt-2 text-sm text-[var(--muted)]">{subjectMsg}</p>
            ) : null}
            <ul className="mt-4 divide-y divide-[var(--stroke)] rounded-[10px] border border-[var(--stroke)]">
              {(meta?.subjects || []).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-[var(--muted)]">{s.code}</span>
                </li>
              ))}
              {!meta?.subjects?.length ? (
                <li className="px-3 py-6 text-center text-[var(--muted)]">
                  Aucune matière
                </li>
              ) : null}
            </ul>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => setSubjectsOpen(false)}
            >
              Fermer
            </Button>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={importCsv}
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5"
          >
            <h2 className="text-xl font-semibold text-[var(--brand-ink)]">
              Importer un EDT (CSV)
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Colonnes :
              weekday;startsAt;endsAt;roomCode;classroom;subjectCode;teacherEmail
              {classroomId
                ? " — les créneaux de la classe filtrée seront remplacés."
                : " — ajout sans remplacement."}
            </p>
            <Textarea
              className="mt-4 min-h-48 font-mono text-sm"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
            {importMsg ? (
              <pre className="mt-3 whitespace-pre-wrap text-sm text-[var(--muted)]">
                {importMsg}
              </pre>
            ) : null}
            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setImportOpen(false)}
              >
                Fermer
              </Button>
              <Button type="submit" className="flex-1">
                Importer
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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
