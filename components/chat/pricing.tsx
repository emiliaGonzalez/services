"use client";

import { useState } from "react";

import { BottomSheet, NumberedOption } from "./bottom-sheet";
import { PriceAmount } from "./price-amount";
import { PriceRanges } from "./price-ranges";

import type { PriceRange, PricingModel } from "@/types/chat";

export interface PricingResult {
  pricingModel: PricingModel;
  variableByHeadcount: boolean;
  basePrice: number;
  priceRanges: PriceRange[];
  summary: string;
}

interface PricingProps {
  onDone: (result: PricingResult) => void;
}

type Stage = "type" | "varies" | "amount" | "ranges";

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="flex items-center gap-1.5 text-sm text-foreground-500 -mt-1 w-fit"
      type="button"
      onClick={onClick}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Atrás
    </button>
  );
}

export function Pricing({ onDone }: PricingProps) {
  const [stage, setStage] = useState<Stage>("type");
  const [model, setModel] = useState<PricingModel>("fixed");

  if (stage === "type") {
    return (
      <BottomSheet title="¿Cómo cobras por este servicio?">
        <div className="flex flex-col">
          <NumberedOption
            label="Precio fijo por evento"
            number={1}
            onClick={() => {
              setModel("fixed");
              setStage("varies");
            }}
          />
          <NumberedOption
            label="Precio por persona (por pax)"
            number={2}
            onClick={() => {
              setModel("per_person");
              setStage("varies");
            }}
          />
        </div>
      </BottomSheet>
    );
  }

  if (stage === "varies") {
    return (
      <BottomSheet title="¿El precio varía según el número de personas?">
        <BackLink onClick={() => setStage("type")} />
        <div className="flex flex-col">
          <NumberedOption
            label="Sí, varía en distintos rangos de personas"
            number={1}
            onClick={() => setStage("ranges")}
          />
          <NumberedOption
            label="No, es el mismo precio para cualquier cantidad"
            number={2}
            onClick={() => setStage("amount")}
          />
        </div>
      </BottomSheet>
    );
  }

  if (stage === "amount") {
    const unit = model === "fixed" ? "por evento" : "por persona";

    return (
      <BottomSheet
        title={model === "fixed" ? "Precio por evento" : "Precio por persona"}
      >
        <BackLink onClick={() => setStage("varies")} />
        <PriceAmount
          unit={unit}
          onConfirm={(amount) =>
            onDone({
              pricingModel: model,
              variableByHeadcount: false,
              basePrice: amount,
              priceRanges: [],
              summary: `${amount.toLocaleString("es-ES")} € ${unit}`,
            })
          }
        />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Rangos de precio por persona">
      <BackLink onClick={() => setStage("varies")} />
      <PriceRanges
        onConfirm={(ranges) =>
          onDone({
            pricingModel: model,
            variableByHeadcount: true,
            basePrice: 0,
            priceRanges: ranges,
            summary: ranges
              .map((r) => `${r.from}-${r.to}: ${r.price} €/pax`)
              .join(" · "),
          })
        }
      />
    </BottomSheet>
  );
}
