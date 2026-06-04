"use client";

import { useState } from "react";

import { Pricing, type PricingResult } from "./pricing";
import { OptionGroups, type OptionGroupsResult } from "./option-groups";

interface PricingFlowProps {
  /** Se llama al pasar de precio a grupos de opciones. */
  onEnterOptions: () => void;
  onDone: (pricing: PricingResult, options: OptionGroupsResult) => void;
}

// Encadena en UI (sin pasar por el modelo): precio -> grupos de opciones.
export function PricingFlow({ onEnterOptions, onDone }: PricingFlowProps) {
  const [pricing, setPricing] = useState<PricingResult | null>(null);

  if (!pricing) {
    return (
      <Pricing
        onDone={(r) => {
          setPricing(r);
          onEnterOptions();
        }}
      />
    );
  }

  return <OptionGroups fullHeight onDone={(o) => onDone(pricing, o)} />;
}
