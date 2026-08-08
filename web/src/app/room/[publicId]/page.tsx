"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  school?: { name: string; city?: string | null } | null;
  slot: Slot | null;
  candidates: Slot[];
  note?: string;
};

export default function RoomPinPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const router = useRouter();
  const pinRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Resolved | null>(null);
  const [slotId, setSlotId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

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

  useEffect(() => {
    if (data) {
      const t = window.setTimeout(() => pinRef.current?.focus(), 150);
      return () => window.clearTimeout(t);
    }
  }, [data]);

  const activeSlot = useMemo(() => {
    if (!data) return null;
    if (data.slot && data.slot.id === slotId) return data.slot;
    return data.candidates.find((c) => c.id === slotId) || data.slot;
  }, [data, slotId]);

  const schoolName = data?.school?.name?.trim() || "";

  function setPinDigits(raw: string) {
    setPin(raw.replace(/\D/g, "").slice(0, 6));
  }

  async function validate() {
    if (pin.length < 6 || !slotId) return;
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
      pinRef.current?.focus();
      return;
    }
    router.push(`/session/${json.sessionId}/hub`);
  }

  useEffect(() => {
    if (pin.length === 6) validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const multiSlot =
    (data?.candidates.length ?? 0) > 1 ||
    (!data?.slot && (data?.candidates.length ?? 0) > 0);

  return (
    <div className="page-shell flex min-h-dvh flex-col !pb-3">
      <AppHeader
        backHref="/scan"
        backLabel="Retour"
        showBrand={false}
        showHome
      />

      {!data && !error ? (
        <p className="text-sm text-[var(--muted)]">Chargement du créneau…</p>
      ) : null}
      {error && !data ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      {data ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="overflow-hidden rounded-[10px] border border-[var(--stroke)]">
            <div className="bg-[var(--brand-ink)] px-4 py-3.5 text-white">
              <p className="text-[11px] uppercase tracking-wide text-white/70">
                {formatDateFr(new Date())}
              </p>
              <p className="mt-2 font-[family-name:var(--font-display)] text-lg font-semibold leading-snug">
                {activeSlot
                  ? `Bienvenue, professeur ${activeSlot.expectedTeacher.displayName}`
                  : "Bienvenue"}
              </p>
              {schoolName ? (
                <p className="mt-1 text-sm text-white/75">{schoolName}</p>
              ) : null}
            </div>
          </div>

          {multiSlot ? (
            <div className="space-y-1.5">
              {data.candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSlotId(c.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
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
          ) : null}

          {activeSlot ? (
            <dl className="surface divide-y divide-[var(--stroke)] px-4">
              {(
                [
                  ["Classe", activeSlot.classroom.name],
                  ["Matière", activeSlot.subject.name],
                  [
                    "Horaire",
                    formatHmRangeFr(activeSlot.startsAt, activeSlot.endsAt),
                  ],
                ] as const
              ).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-3 py-2.5"
                >
                  <dt className="text-sm text-[var(--muted)]">{k}</dt>
                  <dd className="text-right text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-[var(--warn)]">
              Aucun créneau pour cette salle.
            </p>
          )}

          {data.note ? (
            <p className="text-xs text-[var(--warn)]">{data.note}</p>
          ) : null}

          <div className="mt-auto text-center">
            <p className="text-sm font-semibold text-[var(--text)]">
              Saisissez votre PIN
            </p>

            <div className="relative mx-auto mt-4 max-w-[18rem]">
              <input
                ref={pinRef}
                value={pin}
                onChange={(e) => setPinDigits(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                enterKeyHint="done"
                maxLength={6}
                disabled={loading || !slotId}
                aria-label="Code PIN à 6 chiffres"
                className="absolute inset-0 z-10 cursor-text opacity-0"
              />
              <button
                type="button"
                className="flex w-full justify-center gap-2.5"
                onClick={() => pinRef.current?.focus()}
              >
                {Array.from({ length: 6 }).map((_, i) => {
                  const filled = i < pin.length;
                  const active = focused && i === Math.min(pin.length, 5);
                  return (
                    <span
                      key={i}
                      className={`flex h-11 w-11 items-center justify-center rounded-full border text-base font-semibold transition ${
                        active
                          ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]/25"
                          : filled
                            ? "border-[var(--brand)] bg-white"
                            : "border-[var(--stroke)] bg-white"
                      }`}
                    >
                      <span
                        className={
                          filled
                            ? "text-[var(--text)]"
                            : "text-transparent"
                        }
                      >
                        •
                      </span>
                    </span>
                  );
                })}
              </button>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
            ) : null}

            <Button
              className="mt-4 w-full"
              disabled={pin.length < 6 || loading || !slotId}
              onClick={validate}
            >
              {loading ? "Vérification…" : "Continuer"}
            </Button>
            {process.env.NODE_ENV !== "production" ? (
              <div className="mt-2 flex justify-center">
                <Badge tone="info">Démo PIN : 123456</Badge>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
