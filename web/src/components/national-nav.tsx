"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./app-header";

const tabs = [
  {
    href: "/national",
    label: "Vue nationale",
    icon: IconHome,
    exact: true,
  },
  {
    href: "/national/ecoles",
    label: "Écoles",
    icon: IconSchools,
  },
  {
    href: "/national/annees",
    label: "Années",
    icon: IconYears,
  },
];

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSchools({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconYears({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3 10h18M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8 14h3M13 14h3M8 17h3M13 17h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NationalNav() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--stroke)] bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandMark compact href="/national" />
          <span className="hidden rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-ink)] sm:inline">
            Admin national
          </span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="text-sm font-medium text-[var(--muted)] hover:text-[var(--danger)]"
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}

export function NationalBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--stroke)] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-stretch justify-center gap-2 px-2 pb-[env(safe-area-inset-bottom)] pt-1">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href || pathname === `${tab.href}/`
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex min-w-0 flex-1 max-w-[9rem] flex-col items-center gap-0.5 rounded-lg px-0.5 py-2 font-[family-name:var(--font-sans)] text-[10px] sm:text-[11px]",
                active
                  ? "font-semibold text-[var(--brand)]"
                  : "font-medium text-[var(--muted)]",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full transition",
                  active
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "text-[var(--muted)]",
                )}
              >
                <Icon className="shrink-0" />
              </span>
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
