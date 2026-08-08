import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  compact = false,
  href = "/",
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="focus-ring inline-flex items-center gap-2.5 rounded-md">
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--brand-ink)] text-white",
          compact ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm",
        )}
        aria-hidden
      >
        <span className="font-[family-name:var(--font-display)] font-bold tracking-tight">
          eC
        </span>
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
      </span>
      <span className="min-w-0">
        <span className="block font-[family-name:var(--font-display)] text-lg font-semibold leading-none text-[var(--brand-ink)]">
          eCahier
        </span>
        {!compact ? (
          <span className="mt-0.5 block text-[11px] tracking-wide text-[var(--muted)]">
            République gabonaise
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function BackLink({
  href,
  label = "Retour",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="focus-ring inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-[var(--brand-ink)] hover:text-[var(--brand)]"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M10 3L5 8l5 5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </Link>
  );
}

function HomeIconLink() {
  return (
    <Link
      href="/"
      title="Accueil"
      aria-label="Accueil"
      className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--brand-ink)] hover:bg-[var(--brand-soft)]"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

export function AppHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  right,
  showBrand = true,
  showHome = true,
}: {
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  right?: React.ReactNode;
  showBrand?: boolean;
  showHome?: boolean;
}) {
  const isAccueilBack = backLabel === "Accueil" && backHref === "/";

  return (
    <header className="sticky top-0 z-20 -mx-5 mb-3 border-b border-[var(--stroke)] bg-[var(--bg)]/95 px-5 backdrop-blur-sm">
      <div className="flex h-12 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {backHref && !isAccueilBack ? (
            <BackLink href={backHref} label={backLabel} />
          ) : null}
          {showBrand && !backHref ? <BrandMark compact /> : null}
          {title ? (
            <div className="min-w-0">
              {!backHref && showBrand ? null : (
                <p className="truncate text-[15px] font-semibold text-[var(--text)]">
                  {title}
                </p>
              )}
              {!backHref && showBrand && title ? (
                <p className="truncate text-xs text-[var(--muted)]">{title}</p>
              ) : null}
              {subtitle ? (
                <p className="truncate text-xs capitalize text-[var(--muted)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          {showHome ? <HomeIconLink /> : null}
        </div>
      </div>
    </header>
  );
}
