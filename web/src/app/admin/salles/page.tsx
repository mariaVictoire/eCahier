import { redirect } from "next/navigation";

/** Les QR se gèrent depuis Classes (création, impression, modification). */
export default function SallesRedirectPage() {
  redirect("/admin/classes");
}
