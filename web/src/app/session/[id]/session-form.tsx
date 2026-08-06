"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SignaturePad } from "@/components/signature-pad";
import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import { formatDateTimeFr } from "@/lib/datetime";

type Lesson = {
  id: string;
  title: string;
  content: string;
  exercises: string;
  homeworkText: string;
  homeworkDueOn: string | null;
  observations: string;
  status: string;
  signatureImage: string | null;
  validatedAt: string | null;
  classroom: { name: string };
  subject: { name: string };
  room: { label: string };
  teacher: { firstName: string; lastName: string };
  school: { name: string };
};

export default function SessionForm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const fromAdmin = search.get("from") === "admin";

  const [isAdmin, setIsAdmin] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [exercises, setExercises] = useState("");
  const [homeworkText, setHomeworkText] = useState("");
  const [homeworkDueOn, setHomeworkDueOn] = useState("");
  const [observations, setObservations] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [saveState, setSaveState] = useState("Chargement…");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showValidate, setShowValidate] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const role = data?.user?.role;
        setIsAdmin(role === "school_admin" || role === "national_admin");
      })
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Accès refusé");
        return r.json();
      })
      .then((data: Lesson) => {
        setLesson(data);
        setTitle(data.title);
        setContent(data.content);
        setExercises(data.exercises);
        setHomeworkText(data.homeworkText);
        setHomeworkDueOn(
          data.homeworkDueOn ? data.homeworkDueOn.slice(0, 10) : "",
        );
        setObservations(data.observations);
        setSignature(data.signatureImage);
        setSaveState(data.status === "validated" ? "Validée" : "Brouillon");
      })
      .catch(() => setSaveState("Impossible de charger la séance"));
  }, [id]);

  const canEdit =
    !!lesson &&
    (isAdmin || (lesson.status !== "validated" && lesson.status !== "locked"));

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      title,
      content,
      exercises,
      homeworkText,
      homeworkDueOn: homeworkDueOn || null,
      observations,
      signatureImage: signature,
      ...overrides,
    };
  }

  function scheduleSave(next: Record<string, unknown>) {
    if (!canEdit) return;
    setSaveState("Enregistrement…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        setSaveState(isAdmin ? "Correction enregistrée" : "Brouillon enregistré");
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveState(data.message || "Échec d’enregistrement");
      }
    }, 500);
  }

  async function saveAdminCorrection() {
    setError("");
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.message || "Correction impossible");
      return;
    }
    setSaveState("Correction enregistrée");
    router.push("/admin/cahiers");
  }

  async function onValidate(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!signature) {
      setError("La signature est obligatoire");
      return;
    }
    await fetch(`/api/sessions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const res = await fetch(`/api/sessions/${id}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinConfirm: pin, signatureImage: signature }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Validation impossible");
      return;
    }
    setShowValidate(false);
    setLesson((l) =>
      l
        ? {
            ...l,
            status: "validated",
            signatureImage: signature,
            validatedAt: data.validatedAt,
          }
        : l,
    );
    setDone(true);
    setSaveState("Séance validée");
  }

  if (done) {
    return (
      <div className="page-shell flex min-h-dvh flex-col justify-center">
        <div className="surface p-6 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--brand-ink)]">
            Cahier enregistré
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Merci. Pour toute modification ultérieure, adressez-vous à la
            direction.
          </p>
          <Button className="mt-6 w-full" onClick={() => router.push("/")}>
            Terminer
          </Button>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="page-shell md:max-w-2xl">
        <AppHeader
          backHref={fromAdmin || isAdmin ? "/admin/cahiers" : "/"}
          backLabel={fromAdmin || isAdmin ? "Cahiers" : "Accueil"}
          showBrand={false}
        />
        <p className="text-sm text-[var(--muted)]">{saveState}</p>
      </div>
    );
  }

  const teacherName = `${lesson.teacher.firstName} ${lesson.teacher.lastName}`;
  const backHref = fromAdmin || isAdmin ? "/admin/cahiers" : "/";
  const backLabel = fromAdmin || isAdmin ? "Cahiers" : "Accueil";

  return (
    <div className="page-shell pb-10 md:max-w-2xl">
      <AppHeader
        title={`${lesson.classroom.name} · ${lesson.subject.name}`}
        backHref={backHref}
        backLabel={backLabel}
        showBrand={false}
        right={
          <span className="text-[11px] text-[var(--muted)]">{saveState}</span>
        }
      />

      <div className="mb-4 rounded-[10px] border border-[var(--stroke)] bg-[var(--brand-soft)] px-3.5 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--brand-ink)]">
              {lesson.school.name}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {lesson.room.label} · {teacherName}
            </p>
          </div>
          <Badge tone={lesson.status === "validated" ? "ok" : "warn"}>
            {lesson.status === "validated" ? "Validée" : "En cours"}
          </Badge>
        </div>
      </div>

      {isAdmin && lesson.status === "validated" ? (
        <p className="mb-3 rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--brand-ink)]">
          Mode correction direction — enregistré sans nouveau PIN enseignant.
        </p>
      ) : null}

      {!canEdit && !isAdmin ? (
        <p className="mb-3 rounded-[10px] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--muted)]">
          Séance validée. Pour corriger une erreur, contactez la direction.
        </p>
      ) : null}

      <div className="surface p-4 sm:p-5">
        <Field label="Titre de la leçon">
          <Input
            value={title}
            disabled={!canEdit}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave(payload({ title: e.target.value }));
            }}
          />
        </Field>
        <Field label="Contenu du cours">
          <Textarea
            value={content}
            disabled={!canEdit}
            onChange={(e) => {
              setContent(e.target.value);
              scheduleSave(payload({ content: e.target.value }));
            }}
          />
        </Field>
        <Field label="Exercices réalisés">
          <Textarea
            value={exercises}
            disabled={!canEdit}
            onChange={(e) => {
              setExercises(e.target.value);
              scheduleSave(payload({ exercises: e.target.value }));
            }}
          />
        </Field>
        <Field label="Devoirs donnés">
          <Textarea
            value={homeworkText}
            disabled={!canEdit}
            onChange={(e) => {
              setHomeworkText(e.target.value);
              scheduleSave(payload({ homeworkText: e.target.value }));
            }}
          />
        </Field>
        <Field label="Date de remise">
          <Input
            type="date"
            value={homeworkDueOn}
            disabled={!canEdit}
            onChange={(e) => {
              setHomeworkDueOn(e.target.value);
              scheduleSave(payload({ homeworkDueOn: e.target.value || null }));
            }}
          />
        </Field>
        <Field label="Observations">
          <Textarea
            value={observations}
            disabled={!canEdit}
            onChange={(e) => {
              setObservations(e.target.value);
              scheduleSave(payload({ observations: e.target.value }));
            }}
          />
        </Field>

        <div className="mt-2 border-t border-[var(--stroke)] pt-5">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--brand-ink)]">
            Signature du professeur
          </h2>
          <p className="mb-3 text-sm text-[var(--muted)]">{teacherName}</p>
          <SignaturePad
            disabled={!canEdit || (isAdmin && lesson.status === "validated")}
            value={signature}
            onChange={(dataUrl) => {
              setSignature(dataUrl);
              if (canEdit && !(isAdmin && lesson.status === "validated")) {
                scheduleSave(payload({ signatureImage: dataUrl }));
              }
            }}
          />
          {lesson.validatedAt ? (
            <p className="mt-3 text-sm text-[var(--ok)]">
              Signé le {formatDateTimeFr(lesson.validatedAt)}
            </p>
          ) : null}
        </div>

        {canEdit && !isAdmin ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => scheduleSave(payload())}
            >
              Enregistrer brouillon
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                if (!signature) {
                  setError("Signez d’abord en bas du formulaire");
                  return;
                }
                setError("");
                setShowValidate(true);
              }}
            >
              Valider la séance
            </Button>
          </div>
        ) : null}

        {isAdmin && canEdit ? (
          <div className="mt-5">
            <Button type="button" className="w-full" onClick={saveAdminCorrection}>
              Enregistrer la correction
            </Button>
          </div>
        ) : null}

        {error && !showValidate ? (
          <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
        ) : null}
      </div>

      {showValidate ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={onValidate}
            className="w-full max-w-md rounded-[var(--radius-lg)] bg-white p-5"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Valider le cahier
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Confirmez avec votre PIN. Ensuite, seule la direction pourra
              modifier cette séance.
            </p>
            {signature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signature}
                alt="Signature"
                className="mt-3 h-24 w-full rounded-[10px] border border-[var(--stroke)] object-contain"
              />
            ) : null}
            <Field label="PIN">
              <Input
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                autoFocus
              />
            </Field>
            {error ? (
              <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowValidate(false)}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                Confirmer
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
