"use client";

import { useState } from "react";
import { Button } from "@heroui/react";

import type { PriceRange } from "@/types/chat";

interface PriceRangesProps {
  initial?: PriceRange[];
  onConfirm: (ranges: PriceRange[]) => void;
}

const emptyRange = (): PriceRange => ({ from: 0, to: 0, price: 0 });

export function PriceRanges({ initial, onConfirm }: PriceRangesProps) {
  const [ranges, setRanges] = useState<PriceRange[]>(
    initial?.length ? initial : [emptyRange()],
  );

  const patch = (i: number, key: keyof PriceRange, v: number) =>
    setRanges((prev) =>
      prev.map((r, j) => (j === i ? { ...r, [key]: v } : r)),
    );

  const valid = ranges.length > 0 && ranges.every((r) => r.to > 0 && r.price > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 text-xs text-foreground-500">
          <span className="w-24">Desde</span>
          <span className="w-24">Hasta</span>
          <span className="flex-1">Precio/pax</span>
          <span className="w-4" />
        </div>
        {ranges.map((r, i) => (
          <div key={i} className="flex gap-3 items-center">
            <input
              className="w-24 h-9 px-3 rounded-lg border border-divider bg-background text-sm"
              placeholder="Desde"
              type="number"
              value={r.from || ""}
              onChange={(e) => patch(i, "from", Number(e.target.value))}
            />
            <input
              className="w-24 h-9 px-3 rounded-lg border border-divider bg-background text-sm"
              placeholder="Hasta"
              type="number"
              value={r.to || ""}
              onChange={(e) => patch(i, "to", Number(e.target.value))}
            />
            <div className="flex-1 flex items-center h-9 px-3 rounded-lg border border-divider bg-background gap-1.5">
              <span className="text-foreground-400 text-sm">€</span>
              <input
                className="w-full bg-transparent outline-none text-sm"
                placeholder="0"
                type="number"
                value={r.price || ""}
                onChange={(e) => patch(i, "price", Number(e.target.value))}
              />
            </div>
            <button
              className="text-foreground-400 hover:text-danger w-4"
              type="button"
              onClick={() => setRanges(ranges.filter((_, j) => j !== i))}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        <button
          className="text-sm text-foreground-500 flex items-center gap-1.5 mt-1"
          type="button"
          onClick={() =>
            setRanges([
              ...ranges,
              { from: (ranges.at(-1)?.to ?? 0) + 1, to: 0, price: 0 },
            ])
          }
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Agregar rango
        </button>
      </div>
      <div className="flex justify-end">
        <Button
          isDisabled={!valid}
          size="sm"
          variant="primary"
          onPress={() => onConfirm(ranges)}
        >
          Confirmar rangos
        </Button>
      </div>
    </div>
  );
}
