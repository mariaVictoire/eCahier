"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Field, Input, PageTitle } from "@/components/ui";
import { buildSchoolCodePreview } from "@/lib/school-code";

type SchoolRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  schoolYear: string | null;
  admins: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
    isActive: boolean;
  }[];
  counts: {
    classrooms: number;
    rooms: number;
    users: number;
  };
};

export default function NationalSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const generatedCode = useMemo(
    () => buildSchoolCodePreview(name, city),
    [name, city],
  );

  async function load() {
    setLoading(true);
    const res = await fetch("/api/schools");
    const data = await res.json();
    setSchools(data.schools || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    const res = await fetch("/api/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        city,
        adminEmail,
        adminFirstName,
        adminLastName,
        adminPassword,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Création impossible");
      return;
    }
    setOk(`Établissement « ${data.school.name} » créé (${data.school.code}).`);
    setShowForm(false);
    setName("");
    setCity("");
    setAdminEmail("");
    setAdminFirstName("");
    setAdminLastName("");
    setAdminPassword("");
    await load();
  }

  return (
    <div>
      <PageTitle
        title="Établissements"
        subtitle="Création et suivi des écoles"
        action={
          <Button
            type="button"
            variant={showForm ? "secondary" : "primary"}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Fermer" : "Nouvel établissement"}
          </Button>
        }
      />

      {ok ? <p className="mb-4 text-sm text-[var(--ok)]">{ok}</p> : null}

      {showForm ? (
        <form onSubmit={onSubmit} className="surface mb-5 space-y-1 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--brand-ink)]">
            Nouvel établissement
          </h2>
          <Field label="Nom de l’établissement">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lycée …"
              required
            />
          </Field>
          <Field label="Ville">
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Libreville"
              required
            />
          </Field>
          <Field label="Code (généré automatiquement)">
            <Input
              value={generatedCode}
              readOnly
              placeholder="Renseignez le nom et la ville"
              className="bg-[var(--bg)] text-[var(--brand-ink)]"
            />
          </Field>

          <h3 className="mb-2 mt-4 text-sm font-semibold text-[var(--brand-ink)]">
            Compte direction
          </h3>
          <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
            <Field label="Prénom">
              <Input
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
                required
              />
            </Field>
            <Field label="Nom">
              <Input
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="E-mail">
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Mot de passe temporaire">
            <Input
              type="text"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              minLength={6}
            />
          </Field>

          {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}
          <Button
            type="submit"
            className="mt-2 w-full sm:w-auto"
            disabled={saving || !generatedCode}
          >
            {saving ? "Création…" : "Créer l’établissement"}
          </Button>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : (
        <ul className="space-y-3">
          {schools.map((school) => (
            <li key={school.id} className="surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--brand-ink)]">{school.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {school.code}
                    {school.city ? ` · ${school.city}` : ""}
                    {school.schoolYear ? ` · ${school.schoolYear}` : ""}
                  </p>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {school.counts.classrooms} classes · {school.counts.rooms} QR ·{" "}
                  {school.counts.users} comptes
                </p>
              </div>
              {school.admins.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-[var(--stroke)] pt-3">
                  {school.admins.map((admin) => (
                    <li key={admin.id} className="text-sm">
                      <span className="font-medium">
                        {admin.firstName} {admin.lastName}
                      </span>
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {admin.email || "sans e-mail"}
                        {!admin.isActive ? " · inactif" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[var(--warn)]">Aucun compte direction</p>
              )}
            </li>
          ))}
          {schools.length === 0 ? (
            <li className="surface p-4 text-sm text-[var(--muted)]">
              Aucun établissement pour le moment.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
