import type { PriceType } from "@prisma/client";
import type { ServiceDraft } from "@/types/chat";

import { prisma } from "@/lib/prisma";
import { genId } from "@/lib/id";

import { priceTypeFrom } from "./pricing";

// Cliente transaccional de Prisma (el `tx` que recibe $transaction).
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "categoria"
  );
}

// Resuelve la categoria por su nombre (label). Si no existe, crea una entrada custom.
export async function resolveCategoryId(
  tx: TxClient,
  label: string,
): Promise<string> {
  const wanted = label.trim().toLowerCase();
  const all = await tx.category.findMany();
  const match = all.find((c) => {
    const names = (c.names ?? {}) as { es?: string; en?: string };

    return (
      names.es?.trim().toLowerCase() === wanted ||
      names.en?.trim().toLowerCase() === wanted ||
      c.slug === wanted
    );
  });

  if (match) return match.id;

  let slug = slugify(label);

  if (await tx.category.findUnique({ where: { slug } })) {
    slug = `${slug}-${genId("x").slice(2, 8)}`;
  }

  const created = await tx.category.create({
    data: {
      id: genId("cate"),
      slug,
      names: { es: label.trim(), en: label.trim() },
      icon: null,
    },
  });

  return created.id;
}

export interface PreparedTree {
  basePricingId: string;
  pricings: { id: string; type: PriceType }[];
  locations: { id: string; serviceId: string; label: string }[];
  photos: { id: string; serviceId: string; url: string; position: number }[];
  groups: {
    id: string;
    serviceId: string;
    name: string;
    pricingMode: string;
    dependsOnGroupId: string | null;
  }[];
  options: { id: string; groupId: string; name: string; pricingId: string }[];
  ranges: {
    id: string;
    pricingId: string;
    low: number;
    high: number | null;
    price: number;
    dependsOnOptionId: string | null;
  }[];
}

// Genera (en memoria) todos los IDs y filas para persistir el arbol de un servicio.
// No toca la DB; resuelve dependencias entre grupos/opciones por indice.
export function prepareTree(serviceId: string, draft: ServiceDraft): PreparedTree {
  const basePricingId = genId("pric");

  const groups = draft.optionGroups.map((g) => ({
    chatId: g.id,
    id: genId("grou"),
    name: g.name,
    pricingMode: g.pricingMode,
    dependsOn: g.dependsOn,
    optType: (g.pricingMode === "per_pax" ? "PAX" : "FIXED") as PriceType,
    options: g.options.map((o) => ({
      id: genId("optn"),
      pricingId: genId("pric"),
      name: o.name,
      prices: o.prices,
    })),
  }));
  const groupByChatId = new Map(groups.map((g) => [g.chatId, g]));

  const pricings = [
    {
      id: basePricingId,
      type: priceTypeFrom(draft.pricingModel, draft.variableByHeadcount),
    },
    ...groups.flatMap((g) =>
      g.options.map((o) => ({ id: o.pricingId, type: g.optType })),
    ),
  ];

  const ranges: PreparedTree["ranges"] = [];

  if (draft.variableByHeadcount && draft.priceRanges.length) {
    for (const r of draft.priceRanges) {
      ranges.push({
        id: genId("rang"),
        pricingId: basePricingId,
        low: r.from,
        high: r.to > 0 ? r.to : null,
        price: r.price,
        dependsOnOptionId: null,
      });
    }
  } else {
    ranges.push({
      id: genId("rang"),
      pricingId: basePricingId,
      low: 0,
      high: null,
      price: draft.basePrice,
      dependsOnOptionId: null,
    });
  }

  for (const g of groups) {
    const parent = g.dependsOn ? groupByChatId.get(g.dependsOn) : undefined;

    for (const o of g.options) {
      const entries = Object.entries(o.prices).sort(
        (a, b) => Number(a[0]) - Number(b[0]),
      );

      if (parent) {
        for (const [key, price] of entries) {
          ranges.push({
            id: genId("rang"),
            pricingId: o.pricingId,
            low: 0,
            high: null,
            price,
            dependsOnOptionId: parent.options[Number(key)]?.id ?? null,
          });
        }
      } else {
        ranges.push({
          id: genId("rang"),
          pricingId: o.pricingId,
          low: 0,
          high: null,
          price: entries.length ? entries[0][1] : 0,
          dependsOnOptionId: null,
        });
      }
    }
  }

  return {
    basePricingId,
    pricings,
    locations: draft.locations.map((label) => ({
      id: genId("loca"),
      serviceId,
      label,
    })),
    photos: draft.photos.map((url, i) => ({
      id: genId("phot"),
      serviceId,
      url,
      position: i,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      serviceId,
      name: g.name,
      pricingMode: g.pricingMode,
      dependsOnGroupId: g.dependsOn
        ? (groupByChatId.get(g.dependsOn)?.id ?? null)
        : null,
    })),
    options: groups.flatMap((g) =>
      g.options.map((o) => ({
        id: o.id,
        groupId: g.id,
        name: o.name,
        pricingId: o.pricingId,
      })),
    ),
    ranges,
  };
}

// Crea todos los Pricing del arbol (base + opciones). Llamar antes del Service.
export async function writePricings(tx: TxClient, prepared: PreparedTree) {
  if (prepared.pricings.length) {
    await tx.pricing.createMany({ data: prepared.pricings });
  }
}

// Crea los hijos del servicio (ubicaciones, fotos, grupos, opciones, rangos).
// Requiere que el Service y los Pricing ya existan.
export async function writeChildren(tx: TxClient, prepared: PreparedTree) {
  if (prepared.locations.length) {
    await tx.serviceLocation.createMany({ data: prepared.locations });
  }
  if (prepared.photos.length) {
    await tx.servicePhoto.createMany({ data: prepared.photos });
  }
  if (prepared.groups.length) {
    // Crear grupos sin dependencia y luego setearla (evita orden de FK en el bulk insert).
    await tx.optionGroup.createMany({
      data: prepared.groups.map((g) => ({
        id: g.id,
        serviceId: g.serviceId,
        name: g.name,
        pricingMode: g.pricingMode,
      })),
    });
    for (const g of prepared.groups) {
      if (g.dependsOnGroupId) {
        await tx.optionGroup.update({
          where: { id: g.id },
          data: { dependsOnGroupId: g.dependsOnGroupId },
        });
      }
    }
  }
  if (prepared.options.length) {
    await tx.option.createMany({ data: prepared.options });
  }
  if (prepared.ranges.length) {
    await tx.priceRange.createMany({ data: prepared.ranges });
  }
}
