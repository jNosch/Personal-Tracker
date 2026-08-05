import { Suspense } from "react";
import ProgramBuilderClient from "./client";

// PROTOTYPE — throwaway route for wayfinder ticket "Program creation & editing UI"
// (issue #15). Three variants, switchable via ?variant=A|B|C, on a new
// /prototype/program-builder route (no existing page to embed into yet — greenfield
// app). Sample data + scheme catalog live in data.ts.
export default function ProgramBuilderPrototype() {
  return (
    <Suspense fallback={null}>
      <ProgramBuilderClient />
    </Suspense>
  );
}
