import Link from "next/link";

/** Accès Admin (direction ou national). */
export function AccountIconLink({ className }: { className?: string }) {
  return (
    <Link
      href="/login"
      aria-label="Espace Admin"
      title="Espace Admin"
      className={
        className ||
        "focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--brand-ink)] hover:bg-[var(--brand-soft)]"
      }
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M5.5 19.5c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  );
}
