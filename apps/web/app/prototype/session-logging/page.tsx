import { Suspense } from "react";
import SessionLoggingClient from "./client";

// PROTOTYPE — throwaway route for wayfinder ticket "Session logging UI" (issue #14).
// Three variants, switchable via ?variant=A|B|C, on a new /prototype/session-logging
// route (no existing page to embed into yet — greenfield app). Sample data in data.ts.
export default function SessionLoggingPrototype() {
  return (
    <Suspense fallback={null}>
      <SessionLoggingClient />
    </Suspense>
  );
}
