import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { AdminBottomNav, AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.role !== "school_admin") {
    if (session?.role === "national_admin") redirect("/national");
    redirect("/login");
  }

  // Cookie obsolète après un seed : l’utilisateur JWT n’existe plus
  const user = await prisma.user.findFirst({
    where: {
      id: session.sub,
      role: "school_admin",
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, schoolId: true },
  });
  if (!user?.schoolId) {
    await clearSessionCookie();
    redirect("/login?reason=session");
  }
  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { id: true },
  });
  if (!school) {
    await clearSessionCookie();
    redirect("/login?reason=session");
  }

  return (
    <div className="app-shell">
      <AdminNav />
      <main className="app-main">
        <div className="app-page">{children}</div>
      </main>
      <AdminBottomNav />
    </div>
  );
}
