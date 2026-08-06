"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { AccountIconLink } from "@/components/account-icon";

export default function HomePage() {
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminHref, setAdminHref] = useState("/admin");
  const [adminLabel, setAdminLabel] = useState("Admin");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const u = data?.user;
        if (
          u &&
          (u.role === "school_admin" || u.role === "national_admin")
        ) {
          setAdminName(`${u.firstName} ${u.lastName}`.trim());
          if (u.role === "national_admin") {
            setAdminHref("/national");
            setAdminLabel("Admin national");
          } else {
            setAdminHref("/admin");
            setAdminLabel("Admin");
          }
        }
      })
      .catch(() => setAdminName(null));
  }, []);

  return (
    <div className="page-shell flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[var(--accent)] bg-black shadow-[var(--shadow-sm)]">
            <Image
              src="/branding/armoiries-gabon.png"
              alt="Armoiries de la République gabonaise"
              fill
              className="object-cover object-center"
              sizes="48px"
              priority
            />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]">
              République
            </p>
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-ink)]">
              Gabonaise
            </p>
          </div>
        </div>

        {adminName ? (
          <Link
            href={adminHref}
            className="focus-ring max-w-[45%] rounded-md px-2 py-1.5 text-right"
          >
            <span className="block truncate text-sm font-semibold text-[var(--brand-ink)]">
              {adminName}
            </span>
            <span className="block text-[11px] text-[var(--muted)]">
              {adminLabel}
            </span>
          </Link>
        ) : (
          <AccountIconLink />
        )}
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-2 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-[var(--brand-ink)] sm:text-6xl">
          eCahier
        </h1>
        <p className="mt-3 text-base text-[var(--muted)]">
          Cahier de textes simplifié
        </p>

        <div className="mt-14 w-full max-w-sm">
          <Link href="/scan/camera" className="block">
            <Button className="w-full" size="lg">
              Scanner la salle
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
