"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "./app-header";

const tabs = [
  {
    href: "/admin",
    label: "Accueil",
    icon: IconHome,
    exact: true,
  },
  {
    href: "/admin/cahiers",
    label: "Cahiers",
    icon: IconCahiers,
  },
  {
    href: "/admin/edt",
    label: "EDT",
    icon: IconEdt,
  },
  {
    href: "/admin/salles",
    label: "QR",
    icon: IconSalles,
  },
  {
    href: "/admin/enseignants",
    label: "Équipe",
    icon: IconEquipe,
  },
  {
    href: "/admin/exports",
    label: "Exports",
    icon: IconExports,
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
function IconCahiers({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdt({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconSalles({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

function IconEquipe({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3.5 19c1.2-3 3.2-4.5 5.5-4.5s4.3 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M14 14.5c1.4-.6 2.9-.4 4.5 1.2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconExports({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v12M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function AdminNav() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      {/* En-tête — logo = retour à l’accueil admin */}
      <div className="sticky top-0 z-20 border-b border-[var(--stroke)] bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <BrandMark compact href="/admin" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={logout}
              className="text-sm font-medium text-[var(--muted)] hover:text-[var(--danger)]"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Onglets bas avec icônes */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--stroke)] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-stretch justify-between gap-0.5 px-1 pb-[env(safe-area-inset-bottom)] pt-1">
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
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-2 font-[family-name:var(--font-sans)] text-[10px] sm:text-[11px]",
                  active
                    ? "font-semibold text-[var(--brand)]"
                    : "font-medium text-[var(--muted)]",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full transition",
                    active ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--muted)]",
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
    </>
  );
}
