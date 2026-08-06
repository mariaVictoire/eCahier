import { redirect } from "next/navigation";

/** L’historique enseignant sera une évolution future — pour l’instant : scan & saisie. */
export default function MesCoursRedirect() {
  redirect("/");
}
