import { redirect } from "next/navigation";

/** Entrée séance : menu enseignant, ou cahier si ouverture admin. */
export default async function SessionEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  if (from === "admin") {
    redirect(`/session/${id}/cahier?from=admin`);
  }
  redirect(`/session/${id}/hub`);
}
