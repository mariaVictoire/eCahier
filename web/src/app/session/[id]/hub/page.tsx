"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui";
import { formatDateLongFr, formatHmGabon } from "@/lib/datetime";

type HubData = {
  id: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  classroom: { name: string };
  subject: { name: string };
};

export default function SessionHubPage() {
  const { id } = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<HubData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).message || "Accès refusé");
        return r.json();
      })
      .then((data: HubData) => setLesson(data))
      .catch((e: Error) => setError(e.message || "Impossible de charger"));
  }, [id]);

  if (error) {
    return (
      <div className="page-shell">
        <AppHeader
          title="Séance"
          backHref="/"
          backLabel="Accueil"
          showBrand={false}
        />
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="page-shell">
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      </div>
    );
  }

  const horaire = `${formatHmGabon(new Date(lesson.startsAt))} – ${formatHmGabon(new Date(lesson.endsAt))}`;

  return (
    <div className="page-shell pb-10 md:max-w-lg">
      <AppHeader
        title="Que souhaitez-vous faire ?"
        backHref="/"
        backLabel="Accueil"
        showBrand={false}
      />

      <div className="mb-6 rounded-[10px] border border-[var(--stroke)] bg-[var(--brand-soft)] px-4 py-4">
        <p className="text-lg font-semibold text-[var(--brand-ink)]">
          {lesson.classroom.name}
          <span className="font-normal text-[var(--muted)]"> · </span>
          {lesson.subject.name}
        </p>
        <p className="mt-1 text-sm capitalize text-[var(--brand-ink)]/75">
          {formatDateLongFr(lesson.sessionDate)} · {horaire}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link href={`/session/${id}/cahier`} className="block">
          <Button className="w-full" size="lg" variant="secondary">
            Remplir le cahier de textes
          </Button>
        </Link>
        <Link href={`/session/${id}/presence`} className="block">
          <Button className="w-full" size="lg" variant="secondary">
            Liste de présence
          </Button>
        </Link>
        <Link href={`/session/${id}/historique`} className="block">
          <Button className="w-full" size="lg" variant="secondary">
            Consulter mon historique
          </Button>
        </Link>
      </div>
    </div>
  );
}
