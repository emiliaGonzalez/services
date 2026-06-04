import type { ServiceDraft } from "@/types/chat";

import { parsePriceType } from "./pricing";

type DbRange = {
  low: number;
  high: number | null;
  price: unknown;
  dependsOnOptionId: string | null;
};
type DbPricing = { type: string; ranges: DbRange[] } | null;
type DbOption = { id: string; name: string; pricing: DbPricing };
type DbGroup = {
  id: string;
  name: string;
  pricingMode: string;
  dependsOnGroupId: string | null;
  options: DbOption[];
};

// Forma minima que necesita el mapeo (subset de la query con includes).
export type DbServiceForDraft = {
  name: string;
  description: string;
  category: { names: unknown } | null;
  locations: { label: string }[];
  photos: { url: string; position: number }[];
  pricing: DbPricing;
  optionGroups: DbGroup[];
};

// Inverso de save-service: filas de la DB -> ServiceDraft que consume el formulario.
export function serviceToDraft(s: DbServiceForDraft): ServiceDraft {
  const names = (s.category?.names ?? {}) as { es?: string };
  const base = s.pricing
    ? parsePriceType(s.pricing.type)
    : { model: "per_person" as const, variable: false };
  const baseRanges = (s.pricing?.ranges ?? [])
    .slice()
    .sort((a, b) => a.low - b.low);

  const groupById = new Map(s.optionGroups.map((g) => [g.id, g]));

  return {
    name: s.name,
    category: names.es ?? "",
    description: s.description ?? "",
    locations: s.locations.map((l) => l.label),
    photos: s.photos
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((p) => p.url),
    pricingModel: base.model,
    variableByHeadcount: base.variable,
    basePrice: base.variable ? 0 : Number(baseRanges[0]?.price ?? 0),
    priceRanges: base.variable
      ? baseRanges.map((r) => ({
          from: r.low,
          to: r.high ?? 0,
          price: Number(r.price),
        }))
      : [],
    optionGroups: s.optionGroups.map((g) => {
      const parent = g.dependsOnGroupId
        ? groupById.get(g.dependsOnGroupId)
        : undefined;

      return {
        id: g.id,
        name: g.name,
        pricingMode: g.pricingMode === "per_pax" ? "per_pax" : "fixed",
        dependsOn: g.dependsOnGroupId,
        options: g.options.map((o) => {
          const ranges = o.pricing?.ranges ?? [];
          const prices: Record<string, number> = {};

          if (parent) {
            // Cada rango aplica a una opcion del grupo padre -> indice por orden.
            for (const r of ranges) {
              const idx = parent.options.findIndex(
                (po) => po.id === r.dependsOnOptionId,
              );

              prices[String(idx >= 0 ? idx : 0)] = Number(r.price);
            }
          } else {
            prices["0"] = Number(ranges[0]?.price ?? 0);
          }

          return { name: o.name, prices };
        }),
      };
    }),
  };
}
