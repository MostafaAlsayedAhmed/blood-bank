import { redirect } from "next/navigation";

// Staff entry point. The public registration page (/register) arrives in Phase 2.
export default function HomePage() {
  redirect("/dashboard");
}
