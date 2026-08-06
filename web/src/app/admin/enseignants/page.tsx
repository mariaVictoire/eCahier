"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, Field, Input, PageTitle } from "@/components/ui";
import {
  teacherAccountWhatsAppMessage,
  whatsappUrl,
} from "@/lib/phone";

type Teacher = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  pinCode: string | null;
  isActive: boolean;
};

type FormState = {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  pin: string;
  isActive: boolean;
  notifyWhatsApp: boolean;
};

type Notice = {
  text: string;
  whatsappHref: string | null;
};

const emptyForm = (): FormState => ({
  firstName: "",
  lastName: "",
  phone: "",
  pin: "",
  isActive: true,
  notifyWhatsApp: true,
});

export default function EnseignantsPage() {
  const [items, setItems] = useState<Teacher[]>([]);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>(
    {},
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teachers");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setError(data.message || "Chargement impossible");
        return;
      }
      setItems(data.items || []);
      setSchoolName(data.schoolName ?? null);
    } catch {
      setError("Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setNotice(null);
    setForm(emptyForm());
  }

  function openEdit(t: Teacher) {
    setNotice(null);
    setForm({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      phone: t.phone || "",
      pin: "",
      isActive: t.isActive,
      notifyWhatsApp: false,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    setNotice(null);

    if (!form.id && !form.pin) {
      setSaving(false);
      setError("Le PIN est obligatoire pour un nouvel enseignant");
      return;
    }
    if (!form.phone.trim()) {
      setSaving(false);
      setError("Le numéro de téléphone est obligatoire");
      return;
    }

    const body: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      isActive: form.isActive,
    };
    if (form.pin) body.pin = form.pin;

    const res = await fetch(
      form.id ? `/api/teachers/${form.id}` : "/api/teachers",
      {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.message || "Enregistrement impossible");
      return;
    }

    const pin = data.temporaryPin as string | undefined;
    const phone = (data.phone as string) || form.phone;
    let whatsappHref: string | null = null;
    if (pin && phone) {
      whatsappHref = whatsappUrl(
        phone,
        teacherAccountWhatsAppMessage({
          firstName: data.firstName,
          lastName: data.lastName,
          pin,
          schoolName: data.schoolName,
        }),
      );
    }

    if (pin) {
      setNotice({
        text: `Compte créé / PIN mis à jour pour ${data.firstName} ${data.lastName} : ${pin}`,
        whatsappHref,
      });
      if (form.notifyWhatsApp && whatsappHref) {
        window.open(whatsappHref, "_blank", "noopener,noreferrer");
      }
    }

    setForm(null);
    await load();
  }

  async function removeTeacher(t: Teacher) {
    if (
      !confirm(
        `Retirer ${t.firstName} ${t.lastName} de l’établissement ?`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/teachers/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message || "Suppression impossible");
      return;
    }
    await load();
  }

  function togglePin(id: string) {
    setRevealedPins((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function whatsappForTeacher(t: Teacher) {
    if (!t.pinCode || !t.phone) return null;
    return whatsappUrl(
      t.phone,
      teacherAccountWhatsAppMessage({
        firstName: t.firstName,
        lastName: t.lastName,
        pin: t.pinCode,
        schoolName,
      }),
    );
  }

  return (
    <div>
      <PageTitle
        title="Équipe"
        subtitle="Consultez les PIN et retransmettez-les par WhatsApp en cas d’oubli."
        action={
          <Button type="button" size="sm" onClick={openCreate}>
            Ajouter un enseignant
          </Button>
        }
      />

      {notice ? (
        <div className="mb-4 rounded-[10px] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--brand-ink)]">
          <p>{notice.text}</p>
          {notice.whatsappHref ? (
            <a
              href={notice.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-2 font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
            >
              <IconWhatsApp />
              Confirmer la création par WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Chargement…</p>
      ) : (
        <div className="surface overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--stroke)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">PIN</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const revealed = !!revealedPins[t.id];
                const wa = whatsappForTeacher(t);
                return (
                  <tr
                    key={t.id}
                    className="border-b border-[var(--stroke)] last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      {t.firstName} {t.lastName}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {t.phone || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.pinCode ? (
                        <div className="flex items-center gap-1">
                          <span className="font-mono tracking-wider tabular-nums">
                            {revealed
                              ? t.pinCode
                              : "•".repeat(t.pinCode.length)}
                          </span>
                          <button
                            type="button"
                            title={revealed ? "Masquer le PIN" : "Voir le PIN"}
                            aria-label={
                              revealed ? "Masquer le PIN" : "Voir le PIN"
                            }
                            className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--brand-ink)]"
                            onClick={() => togglePin(t.id)}
                          >
                            {revealed ? <IconEyeOff /> : <IconEye />}
                          </button>
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Retransmettre par WhatsApp"
                              aria-label="Retransmettre par WhatsApp"
                              className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--brand)] hover:bg-[var(--brand-soft)]"
                            >
                              <IconWhatsApp />
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={t.isActive ? "ok" : "warn"}>
                        {t.isActive ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-nowrap items-center gap-1">
                        <button
                          type="button"
                          title="Modifier"
                          aria-label="Modifier"
                          className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--brand-ink)] hover:bg-[var(--brand-soft)]"
                          onClick={() => openEdit(t)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          aria-label="Supprimer"
                          className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--danger)] hover:bg-red-50"
                          onClick={() => removeTeacher(t)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--muted)]"
                  >
                    Aucun enseignant. Ajoutez le premier.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {form ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={onSubmit}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--brand-ink)]">
              {form.id ? "Modifier l’enseignant" : "Nouvel enseignant"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Le téléphone sert à envoyer le PIN par WhatsApp. Le PIN confirme
              l’identité en salle après le scan QR.
            </p>

            <div className="mt-4 space-y-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Prénom">
                  <Input
                    value={form.firstName}
                    onChange={(e) =>
                      setForm({ ...form, firstName: e.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Nom">
                  <Input
                    value={form.lastName}
                    onChange={(e) =>
                      setForm({ ...form, lastName: e.target.value })
                    }
                    required
                  />
                </Field>
              </div>
              <Field label="Téléphone (WhatsApp)">
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="ex. 077012345 ou +24177012345"
                  required
                />
              </Field>
              <Field
                label={
                  form.id
                    ? "Nouveau PIN (laisser vide pour ne pas changer)"
                    : "Code PIN"
                }
              >
                <Input
                  inputMode="numeric"
                  value={form.pin}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pin: e.target.value.replace(/\D/g, "").slice(0, 8),
                    })
                  }
                  placeholder="4 à 8 chiffres"
                  required={!form.id}
                />
              </Field>
              {!form.id ? (
                <label className="mb-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={form.notifyWhatsApp}
                    onChange={(e) =>
                      setForm({ ...form, notifyWhatsApp: e.target.checked })
                    }
                  />
                  <span>
                    Confirmer la création du compte par WhatsApp (ouvre une
                    conversation avec le PIN prérempli)
                  </span>
                </label>
              ) : (
                <>
                  <label className="mb-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm({ ...form, isActive: e.target.checked })
                      }
                    />
                    Compte actif
                  </label>
                  {form.pin ? (
                    <label className="mb-3 flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={form.notifyWhatsApp}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            notifyWhatsApp: e.target.checked,
                          })
                        }
                      />
                      <span>
                        Envoyer le nouveau PIN par WhatsApp après
                        enregistrement
                      </span>
                    </label>
                  ) : null}
                </>
              )}
            </div>

            {error ? (
              <p className="mb-3 text-sm text-[var(--danger)]">{error}</p>
            ) : null}

            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setForm(null)}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function IconEdit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10.8 10.8 0 0 1 12 5c7 0 11 7 11 7a18.4 18.4 0 0 1-4.2 4.6M6.1 6.1C3.5 7.8 1 12 1 12s4 7 11 7c1.4 0 2.7-.3 3.9-.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}
