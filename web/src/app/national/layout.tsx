import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { NationalBottomNav, NationalNav } from "@/components/national-nav";

export default async function NationalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "school_admin") redirect("/admin");
  if (session.role !== "national_admin") redirect("/login");

  return (
    <div className="app-shell">
      <NationalNav />
      <main className="app-main">
        <div className="app-page">{children}</div>
      </main>
      <NationalBottomNav />
    </div>
  );
}
