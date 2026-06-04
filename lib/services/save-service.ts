import type { PriceType } from "@prisma/client";
import type { ServiceDraft } from "@/types/chat";

import { prisma } from "@/lib/prisma";
import { genId } from "@/lib/id";

// pricingModel + variableByHeadcount -> enum PriceType del catalogo.
function priceType(
  model: ServiceDraft["pricingModel"],
  variable: boolean,
): PriceType {
  const base = model === "per_person" ? "PAX" : model === "per_unit" ? "UNIT" : "FIXED";

  return (variable ? `${base}_RANGE` : base) as PriceType;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "categoria";
}

// Resuelve la categoria por su nombre en espanol (label del chat). Si no existe en el
// catalogo (p.ej. una categoria "Otra" libre), crea una entrada custom.
async function resolveCategoryId(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
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

// Persiste un ServiceDraft completo del chat de forma normalizada y atomica.
// Devuelve el id (serv_) del servicio creado.
export async function saveService(
  draft: ServiceDraft,
  ownerId: string,
): Promise<string> {
  // Pre-generamos todos los IDs en memoria para resolver dependencias por indice
  // y poder escribir en pocas sentencias createMany (clave con el pooler de Supabase).
  const serviceId = genId("serv");
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

  // Rangos de precio (se calculan en memoria; los dependsOnOptionId apuntan a IDs ya generados).
  const priceRanges: {
    id: string;
    pricingId: string;
    low: number;
    high: number | null;
    price: number;
    dependsOnOptionId: string | null;
  }[] = [];

  if (draft.variableByHeadcount && draft.priceRanges.length) {
    for (const r of draft.priceRanges) {
      priceRanges.push({
        id: genId("rang"),
        pricingId: basePricingId,
        low: r.from,
        high: r.to > 0 ? r.to : null,
        price: r.price,
        dependsOnOptionId: null,
      });
    }
  } else {
    priceRanges.push({
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
        // Un precio por cada opcion del grupo del que depende.
        for (const [key, price] of entries) {
          priceRanges.push({
            id: genId("rang"),
            pricingId: o.pricingId,
            low: 0,
            high: null,
            price,
            dependsOnOptionId: parent.options[Number(key)]?.id ?? null,
          });
        }
      } else {
        priceRanges.push({
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

  return prisma.$transaction(
    async (tx) => {
      const categoryId = await resolveCategoryId(tx, draft.category);

      // 1. Todos los Pricing (base + cada opcion) en una sentencia.
      await tx.pricing.createMany({
        data: [
          {
            id: basePricingId,
            type: priceType(draft.pricingModel, draft.variableByHeadcount),
          },
          ...groups.flatMap((g) =>
            g.options.map((o) => ({ id: o.pricingId, type: g.optType })),
          ),
        ],
      });

      // 2. Service (referencia el pricing base ya creado).
      await tx.service.create({
        data: {
          id: serviceId,
          ownerId,
          categoryId,
          name: draft.name.trim(),
          description: draft.description?.trim() ?? "",
          pricingId: basePricingId,
        },
      });

      // 3. Ubicaciones y fotos.
      if (draft.locations.length) {
        await tx.serviceLocation.createMany({
          data: draft.locations.map((label) => ({
            id: genId("loca"),
            serviceId,
            label,
          })),
        });
      }
      if (draft.photos.length) {
        await tx.servicePhoto.createMany({
          data: draft.photos.map((url, i) => ({
            id: genId("phot"),
            serviceId,
            url,
            position: i,
          })),
        });
      }

      // 4. Grupos (sin dependencia) y luego las dependencias entre grupos.
      if (groups.length) {
        await tx.optionGroup.createMany({
          data: groups.map((g) => ({
            id: g.id,
            serviceId,
            name: g.name,
            pricingMode: g.pricingMode,
          })),
        });
        for (const g of groups) {
          const parent = g.dependsOn ? groupByChatId.get(g.dependsOn) : undefined;

          if (parent) {
            await tx.optionGroup.update({
              where: { id: g.id },
              data: { dependsOnGroupId: parent.id },
            });
          }
        }
      }

      // 5. Opciones (su pricing ya existe).
      const optionData = groups.flatMap((g) =>
        g.options.map((o) => ({
          id: o.id,
          groupId: g.id,
          name: o.name,
          pricingId: o.pricingId,
        })),
      );

      if (optionData.length) {
        await tx.option.createMany({ data: optionData });
      }

      // 6. Todos los rangos al final (sus dependsOnOptionId ya existen).
      if (priceRanges.length) {
        await tx.priceRange.createMany({ data: priceRanges });
      }

      return serviceId;
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}
