import { Suspense } from "react";
import ProgressChartsClient from "./client";

// PROTOTYPE — throwaway route for wayfinder ticket "Progress chart requirements" (issue #6).
// Three variants, switchable via ?variant=A|B|C, on a new /prototype/progress-charts route
// (no existing page to embed into yet — this is a greenfield app). Sample data lives in data.ts.
export default function ProgressChartsPrototype() {
  return (
    <Suspense fallback={null}>
      <ProgressChartsClient />
    </Suspense>
  );
}
