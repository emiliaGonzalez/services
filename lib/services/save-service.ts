import type { ServiceDraft } from "@/types/chat";

import { prisma } from "@/lib/prisma";
import { genId } from "@/lib/id";

import {
  prepareTree,
  resolveCategoryId,
  writeChildren,
  writePricings,
} from "./service-tree";

// Persiste un ServiceDraft completo del chat de forma normalizada y atomica.
// Devuelve el id (serv_) del servicio creado.
export async function saveService(
  draft: ServiceDraft,
  ownerId: string,
): Promise<string> {
  const serviceId = genId("serv");
  const prepared = prepareTree(serviceId, draft);

  return prisma.$transaction(
    async (tx) => {
      const categoryId = await resolveCategoryId(tx, draft.category);

      await writePricings(tx, prepared);

      await tx.service.create({
        data: {
          id: serviceId,
          ownerId,
          categoryId,
          name: draft.name.trim(),
          description: draft.description?.trim() ?? "",
          pricingId: prepared.basePricingId,
        },
      });

      await writeChildren(tx, prepared);

      return serviceId;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}
