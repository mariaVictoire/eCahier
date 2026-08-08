import { redirect } from "next/navigation";

/** Ancienne URL — le menu salle remplace cette entrée. */
export default function MesCoursRedirect() {
  redirect("/");
}
