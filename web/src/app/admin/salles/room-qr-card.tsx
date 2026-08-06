"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { buildLabeledSticker, printStickerImage } from "@/lib/qr-sticker";

export function RoomQrCard({
  id,
  code,
  label,
  building,
  publicId,
  url,
  isActive = true,
  highlight = false,
  onToggleActive,
  onDelete,
}: {
  id: string;
  code: string;
  label: string;
  building?: string | null;
  publicId: string;
  url: string;
  isActive?: boolean;
  highlight?: boolean;
  onToggleActive?: (id: string, next: boolean) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const title = label || `Salle ${code}`;
  const [src, setSrc] = useState("");
  const [stickerSrc, setStickerSrc] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QR = await import("qrcode");
      const qrDataUrl = await QR.toDataURL(url, {
        width: 280,
        margin: 1,
        color: { dark: "#004D2E", light: "#FFFFFF" },
      });
      if (cancelled) return;
      setSrc(qrDataUrl);

      const sticker = await buildLabeledSticker({
        qrDataUrl,
        title,
      });
      if (cancelled) return;
      setStickerSrc(sticker);
    })();
    return () => {
      cancelled = true;
    };
  }, [url, title]);

  async function handleToggle() {
    if (!onToggleActive || busy) return;
    setBusy(true);
    try {
      await onToggleActive(id, !isActive);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || busy) return;
    if (
      !confirm(
        `Supprimer le QR de « ${title} » ? Il ne pourra plus être scanné.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await onDelete(id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      id={`room-${publicId}`}
      className={
        highlight
          ? "surface overflow-hidden ring-2 ring-[var(--accent)]"
          : "surface overflow-hidden"
      }
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-sans)] text-xl font-semibold tracking-tight text-[var(--brand-ink)]">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] tracking-wide text-[var(--muted)]">
            {code}
            {building ? ` · ${building}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Badge tone={isActive ? "ok" : "warn"}>
            {isActive ? "Actif" : "Désactivé"}
          </Badge>
          <button
            type="button"
            title={isActive ? "Désactiver" : "Réactiver"}
            aria-label={isActive ? "Désactiver" : "Réactiver"}
            disabled={busy}
            onClick={handleToggle}
            className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--brand-ink)] hover:bg-[var(--brand-soft)] disabled:opacity-45"
          >
            {isActive ? <IconPause /> : <IconPlay />}
          </button>
          <button
            type="button"
            title="Supprimer"
            aria-label="Supprimer"
            disabled={busy}
            onClick={handleDelete}
            className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--danger)] hover:bg-red-50 disabled:opacity-45"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      <div
        className={`flex justify-center px-4 py-5 ${isActive ? "bg-[var(--bg)]" : "bg-[var(--bg)] opacity-55"}`}
      >
        <div className="w-full max-w-[220px] overflow-hidden rounded-[14px] border border-[var(--stroke)] bg-white shadow-[var(--shadow-sm)]">
          <div className="bg-[var(--brand-ink)] px-3 py-3 text-center">
            <p className="font-[family-name:var(--font-sans)] text-[1.15rem] font-semibold leading-tight text-white">
              {title}
            </p>
          </div>
          <div className="flex justify-center p-4">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`QR ${title}`} className="h-36 w-36" />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center text-sm text-[var(--muted)]">
                Génération…
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--stroke)] px-4 py-3">
        {isActive ? (
          <Link
            href={`/room/${publicId}`}
            className="text-sm font-semibold text-[var(--brand)] hover:underline"
          >
            Tester
          </Link>
        ) : (
          <span className="text-sm text-[var(--muted)]">Scan désactivé</span>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!stickerSrc || !isActive}
            onClick={() => stickerSrc && printStickerImage(stickerSrc, title)}
          >
            Imprimer
          </Button>
          <a
            href={isActive && stickerSrc ? stickerSrc : undefined}
            download={`etiquette-qr-${code}.png`}
            className={
              isActive && stickerSrc
                ? "inline-flex h-9 items-center rounded-lg border border-[var(--stroke-strong)] bg-white px-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg)]"
                : "pointer-events-none inline-flex h-9 items-center rounded-lg px-3 text-sm text-[var(--muted)]"
            }
          >
            Télécharger
          </a>
        </div>
      </div>
    </article>
  );
}

function IconPause() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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
