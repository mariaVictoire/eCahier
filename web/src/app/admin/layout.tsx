import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
