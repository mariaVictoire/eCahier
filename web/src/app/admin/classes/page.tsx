import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/ui";
import { ClassesManager } from "./classes-manager";

export default async function ClassesPage() {
  const session = await getSession();
  const subjects = await prisma.subject.findMany({
    where: { schoolId: session!.schoolId! },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <ClassesManager />

      <section>
        <PageTitle
          title="Matières"
          subtitle="Référentiel des disciplines de l’établissement."
        />
        <div className="surface overflow-hidden">
          <ul className="divide-y divide-[var(--stroke)]">
            {subjects.map((s) => (
              <li
                key={s.id}
                className="flex justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium">{s.name}</span>
                <span className="text-[var(--muted)]">{s.code}</span>
              </li>
            ))}
            {subjects.length === 0 ? (
              <li className="px-4 py-8 text-center text-[var(--muted)]">
                Aucune matière pour le moment.
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
