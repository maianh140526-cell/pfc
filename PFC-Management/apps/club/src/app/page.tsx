import { redirect } from "next/navigation";

/** Canonical lobby lives at `/lobby` — keep `/` as alias. */
export default function RootPage() {
  redirect("/lobby");
}
