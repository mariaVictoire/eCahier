import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageTitle } from "@/components/ui";
import { ExportButtons } from "./export-buttons";

export default async function ExportsPage() {
  const session = await getSession();
  const [classrooms, school] = await Promise.all([
    prisma.classroom.findMany({
      where: { schoolId: session!.schoolId!, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.school.findUnique({ where: { id: session!.schoolId! } }),
  ]);

  return (
    <div>
      <PageTitle
        title="Exports"
      />
      <div className="surface p-5">
        <ExportButtons
          schoolName={school?.name || "Établissement"}
          classrooms={classrooms.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>
    </div>
  );
}
