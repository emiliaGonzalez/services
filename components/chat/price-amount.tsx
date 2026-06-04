"use client";

import { useState } from "react";
import { Button } from "@heroui/react";

interface PriceAmountProps {
  unit?: string;
  onConfirm: (amount: number) => void;
}

export function PriceAmount({ unit, onConfirm }: PriceAmountProps) {
  const [value, setValue] = useState("");
  const amount = Number(value);
  const valid = value !== "" && amount > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center h-12 px-4 rounded-xl border border-divider gap-2">
        <span className="text-foreground-500">€</span>
        <input
          autoFocus
          className="flex-1 bg-transparent outline-none text-base text-foreground placeholder:text-foreground-400"
          inputMode="decimal"
          min={0}
          placeholder="0"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valid && onConfirm(amount)}
        />
        {unit && <span className="text-sm text-foreground-400">{unit}</span>}
      </div>
      <div className="flex justify-end">
        <Button
          isDisabled={!valid}
          size="sm"
          variant="primary"
          onPress={() => onConfirm(amount)}
        >
          Confirmar
        </Button>
      </div>
    </div>
  );
}
