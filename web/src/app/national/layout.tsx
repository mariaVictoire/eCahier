import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { NationalNav } from "@/components/national-nav";

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
    <div className="flex min-h-dvh flex-col bg-[var(--bg)]">
      <NationalNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-7">
        {children}
      </main>
    </div>
  );
}
