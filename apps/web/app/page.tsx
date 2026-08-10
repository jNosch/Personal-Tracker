import { redirect } from "next/navigation";

// #38: Progress is the effective landing page — no real content lives at
// `/` itself, and the nav (Nav.tsx) deliberately has no link back to it.
export default function Home() {
  redirect("/progress");
}
