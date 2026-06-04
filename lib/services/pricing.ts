import type { PriceType } from "@prisma/client";
import type { PricingModel } from "@/types/chat";

// pricingModel + variableByHeadcount -> enum PriceType del catalogo.
export function priceTypeFrom(
  model: PricingModel,
  variable: boolean,
): PriceType {
  const base =
    model === "per_person" ? "PAX" : model === "per_unit" ? "UNIT" : "FIXED";

  return (variable ? `${base}_RANGE` : base) as PriceType;
}

// Inverso: enum PriceType -> { pricingModel, variableByHeadcount }.
export function parsePriceType(type: PriceType | string): {
  model: PricingModel;
  variable: boolean;
} {
  const variable = type.endsWith("_RANGE");
  const base = type.replace("_RANGE", "");
  const model: PricingModel =
    base === "PAX" ? "per_person" : base === "UNIT" ? "per_unit" : "fixed";

  return { model, variable };
}

export type PricingForSummary = {
  type: PriceType | string;
  ranges: { price: unknown }[];
} | null;

function fmt(n: number): string {
  return `€${n.toLocaleString("es-MX")}`;
}

// Resumen corto del precio base, p.ej. "Desde $580/pax" o "$8,500 fijo".
export function priceSummary(pricing: PricingForSummary): string {
  if (!pricing || !pricing.ranges.length) return "—";
  const prices = pricing.ranges.map((r) => Number(r.price));
  const min = Math.min(...prices);

  switch (pricing.type) {
    case "FIXED":
      return `${fmt(min)} fijo`;
    case "PAX":
      return `${fmt(min)}/pax`;
    case "UNIT":
      return `${fmt(min)}/unidad`;
    case "FIXED_RANGE":
      return `Desde ${fmt(min)}`;
    case "PAX_RANGE":
      return `Desde ${fmt(min)}/pax`;
    case "UNIT_RANGE":
      return `Desde ${fmt(min)}/unidad`;
    default:
      return fmt(min);
  }
}
