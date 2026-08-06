"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Badge, Button } from "@/components/ui";
import { formatDateFr } from "@/lib/utils";
import { formatHmRangeFr } from "@/lib/datetime";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  classroom: { name: string };
  subject: { name: string };
  expectedTeacher: { displayName: string };
};

type Resolved = {
  room: { code: string; label: string };
  school: { name: string; city?: string | null };
  slot: Slot | null;
  candidates: Slot[];
  note?: string;
};

export default function RoomPinPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const router = useRouter();
  const [data, setData] = useState<Resolved | null>(null);
  const [slotId, setSlotId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/rooms/${publicId}/current-slot`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Salle introuvable");
        return r.json();
      })
      .then((json: Resolved) => {
        setData(json);
        if (json.slot) setSlotId(json.slot.id);
        else if (json.candidates[0]) setSlotId(json.candidates[0].id);
      })
      .catch(() => setError("Salle introuvable"));
  }, [publicId]);

  const activeSlot = useMemo(() => {
    if (!data) return null;
    if (data.slot && data.slot.id === slotId) return data.slot;
    return data.candidates.find((c) => c.id === slotId) || data.slot;
  }, [data, slotId]);

  function press(d: string) {
    if (pin.length >= 6) return;
    setPin((p) => p + d);
  }

  async function validate() {
    if (pin.length < 4 || !slotId) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomPublicId: publicId, pin, slotId }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.message || "Code incorrect");
      setPin("");
      return;
    }
    router.push(`/session/${json.sessionId}`);
  }

  useEffect(() => {
    if (pin.length === 6) validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="page-shell">
      <AppHeader
        title={data?.room.label || "Salle"}
        backHref="/scan"
        backLabel="Retour"
        showBrand={false}
      />

      {!data && !error ? (
        <p className="text-sm text-[var(--muted)]">Chargement du créneau…</p>
      ) : null}
      {error && !data ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      {data ? (
        <>
          <div className="surface overflow-hidden">
            <div className="border-b border-[var(--stroke)] bg-[var(--brand-ink)] px-4 py-4 text-white">
              <p className="text-xs uppercase tracking-wide text-white/70">
                Établissement
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold">
                {data.school.name}
              </p>
              {data.school.city ? (
                <p className="mt-0.5 text-sm text-white/75">{data.school.city}</p>
              ) : null}
            </div>
            <div className="px-4 py-3 text-sm text-[var(--muted)] capitalize">
              {formatDateFr(new Date())} · {data.room.label}
            </div>
          </div>

          {(data.candidates.length > 1 || !data.slot) &&
          data.candidates.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Créneau
              </p>
              <div className="space-y-2">
                {data.candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSlotId(c.id)}
                    className={`w-full rounded-[10px] border px-4 py-3 text-left text-sm transition ${
                      slotId === c.id
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-[var(--stroke)] bg-white"
                    }`}
                  >
                    <span className="font-semibold">
                      {formatHmRangeFr(c.startsAt, c.endsAt)}
                    </span>
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {c.classroom.name} · {c.subject.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeSlot ? (
            <dl className="surface mt-4 divide-y divide-[var(--stroke)] px-4">
              {(
                [
                  ["Classe", activeSlot.classroom.name],
                  ["Matière", activeSlot.subject.name],
                  ["Enseignant prévu", activeSlot.expectedTeacher.displayName],
                  ["Horaire", formatHmRangeFr(activeSlot.startsAt, activeSlot.endsAt)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 py-3">
                  <dt className="text-sm text-[var(--muted)]">{k}</dt>
                  <dd className="text-right text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-[var(--warn)]">
              Aucun créneau pour cette salle.
            </p>
          )}

          {data.note ? (
            <p className="mt-2 text-xs text-[var(--warn)]">{data.note}</p>
          ) : null}

          <div className="mt-8 text-center">
            <p className="text-sm font-semibold text-[var(--text)]">
              Confirmez votre identité
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Code PIN de{" "}
              <span className="font-medium text-[var(--text)]">
                {activeSlot.expectedTeacher.displayName}
              </span>
            </p>
            <div className="my-5 flex justify-center gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${
                    i < pin.length ? "bg-[var(--brand)]" : "bg-[var(--stroke)]"
                  }`}
                />
              ))}
            </div>
            {error ? (
              <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <div className="mx-auto grid max-w-[17rem] grid-cols-3 gap-2">
              {"123456789".split("").map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => press(d)}
                  className="h-14 rounded-[10px] border border-[var(--stroke)] bg-white text-xl font-semibold text-[var(--text)] active:bg-[var(--bg)]"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin("")}
                className="h-14 text-xs font-medium text-[var(--muted)]"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => press("0")}
                className="h-14 rounded-[10px] border border-[var(--stroke)] bg-white text-xl font-semibold"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPin((p) => p.slice(0, -1))}
                className="h-14 text-xs font-medium text-[var(--muted)]"
              >
                Corriger
              </button>
            </div>
            <Button
              className="mt-5 w-full"
              disabled={pin.length < 4 || loading || !slotId}
              onClick={validate}
            >
              {loading ? "Vérification…" : "Continuer"}
            </Button>
            <div className="mt-3 flex justify-center">
              <Badge tone="info">Démo PIN : 123456</Badge>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
