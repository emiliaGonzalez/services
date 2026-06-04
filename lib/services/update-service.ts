import type { ServiceDraft } from "@/types/chat";

import { prisma } from "@/lib/prisma";

import {
  prepareTree,
  resolveCategoryId,
  writeChildren,
  writePricings,
} from "./service-tree";

export class ServiceNotFoundError extends Error {}
export class ServiceForbiddenError extends Error {}

// Reescribe por completo el arbol de un servicio existente (manteniendo su id),
// validando que pertenezca a ownerId. Atomico.
export async function updateService(
  id: string,
  draft: ServiceDraft,
  ownerId: string,
): Promise<string> {
  const prepared = prepareTree(id, draft);

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.service.findUnique({
        where: { id },
        select: {
          ownerId: true,
          pricingId: true,
          optionGroups: { select: { options: { select: { pricingId: true } } } },
        },
      });

      if (!existing) throw new ServiceNotFoundError(id);
      if (existing.ownerId !== ownerId) throw new ServiceForbiddenError(id);

      // Pricings viejos (base + opciones); al borrarlos cae en cascada sus price_ranges.
      const oldPricingIds = [
        existing.pricingId,
        ...existing.optionGroups.flatMap((g) =>
          g.options.map((o) => o.pricingId),
        ),
      ].filter(Boolean) as string[];

      const categoryId = await resolveCategoryId(tx, draft.category);

      // Soltar la referencia al pricing base y borrar todos los hijos viejos.
      await tx.service.update({ where: { id }, data: { pricingId: null } });
      await tx.optionGroup.deleteMany({ where: { serviceId: id } });
      await tx.serviceLocation.deleteMany({ where: { serviceId: id } });
      await tx.servicePhoto.deleteMany({ where: { serviceId: id } });
      if (oldPricingIds.length) {
        await tx.pricing.deleteMany({ where: { id: { in: oldPricingIds } } });
      }

      // Escribir el arbol nuevo.
      await writePricings(tx, prepared);
      await tx.service.update({
        where: { id },
        data: {
          categoryId,
          name: draft.name.trim(),
          description: draft.description?.trim() ?? "",
          pricingId: prepared.basePricingId,
        },
      });
      await writeChildren(tx, prepared);

      return id;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}
