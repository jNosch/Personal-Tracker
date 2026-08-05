"use client";

import { useSearchParams } from "next/navigation";
import VariantA from "./VariantA";
import VariantB from "./VariantB";
import VariantC from "./VariantC";
import VariantD from "./VariantD";
import PrototypeSwitcher from "./PrototypeSwitcher";

export default function SessionLoggingClient() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {variant === "D" && <VariantD />}
      <PrototypeSwitcher current={variant} />
    </>
  );
}
