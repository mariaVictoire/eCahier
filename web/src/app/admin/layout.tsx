import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !["school_admin", "national_admin"].includes(session.role)) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)]">
      <AdminNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-7">
        {children}
      </main>
    </div>
  );
}
