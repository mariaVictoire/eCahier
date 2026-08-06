import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatShortDate } from "@/lib/utils";
import { formatDateTimeFr } from "@/lib/datetime";
import { PrintButton } from "@/components/print-button";

export default async function PrintCahierPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const session = await getSession();
  if (!session || !["school_admin", "national_admin"].includes(session.role)) {
    redirect("/login");
  }

  const { classroomId } = await params;
  const classroom = await prisma.classroom.findFirst({
    where: { id: classroomId, schoolId: session.schoolId! },
    include: { school: true, schoolYear: true },
  });
  if (!classroom) notFound();

  const sessions = await prisma.lessonSession.findMany({
    where: {
      classroomId,
      schoolId: session.schoolId!,
      deletedAt: null,
    },
    include: { subject: true, teacher: true, room: true },
    orderBy: [{ sessionDate: "asc" }, { startsAt: "asc" }],
  });

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-[var(--text)] print:max-w-none">
      <PrintButton />
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
        Cahier de textes — {classroom.name}
      </h1>
      <p className="mt-1 text-[var(--muted)]">
        {classroom.school.name} · {classroom.schoolYear.label}
      </p>

      {sessions.length === 0 ? (
        <p className="mt-8">Aucune séance enregistrée.</p>
      ) : (
        <div className="mt-8 space-y-6">
          {sessions.map((s) => (
            <article
              key={s.id}
              className="break-inside-avoid border-t border-[var(--stroke)] pt-4"
            >
              <h2 className="text-lg font-semibold">
                {formatShortDate(s.sessionDate)} — {s.subject.name}
              </h2>
              <p className="text-sm text-[var(--muted)]">
                {s.teacher.firstName} {s.teacher.lastName} · {s.room.label} ·{" "}
                {s.status}
              </p>
              <p className="mt-2 font-semibold">{s.title || "(sans titre)"}</p>
              <p className="mt-1 whitespace-pre-wrap">{s.content}</p>
              {s.exercises ? (
                <p className="mt-2">
                  <em>Exercices :</em> {s.exercises}
                </p>
              ) : null}
              {s.homeworkText ? (
                <p className="mt-2">
                  <em>Devoirs :</em> {s.homeworkText}
                  {s.homeworkDueOn
                    ? ` (remise ${formatShortDate(s.homeworkDueOn)})`
                    : ""}
                </p>
              ) : null}
              {s.observations ? (
                <p className="mt-2">
                  <em>Observations :</em> {s.observations}
                </p>
              ) : null}
              {s.signatureImage ? (
                <div className="mt-3">
                  <p className="text-sm text-[var(--muted)]">
                    Signature — {s.teacher.firstName} {s.teacher.lastName}
                    {s.validatedAt
                      ? ` · ${formatDateTimeFr(s.validatedAt)}`
                      : ""}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.signatureImage}
                    alt="Signature"
                    className="mt-1 h-20 object-contain"
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
