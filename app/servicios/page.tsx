import { Chip } from "@heroui/react";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

type PricingWithRanges = {
  type: string;
  ranges: { price: unknown }[];
} | null;

function fmt(n: number): string {
  return `$${n.toLocaleString("es-MX")}`;
}

function priceSummary(pricing: PricingWithRanges): string {
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

export default async function ServiciosPage() {
  const { userId } = await auth();

  const rows = userId
    ? await prisma.service.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
          locations: true,
          pricing: { include: { ranges: true } },
        },
      })
    : [];

  const services = rows.map((s) => {
    const names = (s.category?.names ?? {}) as { es?: string };

    return {
      id: s.id,
      name: s.name,
      category: names.es ?? "—",
      locations: s.locations.map((l) => l.label).join(", ") || "—",
      price: priceSummary(s.pricing),
    };
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-8 py-5">
        <span className="text-sm text-foreground-500">
          {services.length} servicios
        </span>
        <div className="flex items-center gap-3">
          <input
            className="h-9 w-56 px-3 rounded-lg bg-foreground-50 border border-divider text-sm placeholder:text-foreground-400 outline-none"
            placeholder="Buscar servicio..."
          />
          <a
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-foreground text-background text-sm font-semibold no-underline"
            href="/servicios/nuevo"
          >
            + Nuevo servicio
          </a>
        </div>
      </div>

      <div className="flex-1 px-8">
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <span className="text-sm text-foreground-500">
              Aún no tienes servicios.
            </span>
            <a
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-foreground text-background text-sm font-semibold no-underline"
              href="/servicios/nuevo"
            >
              + Crear el primero
            </a>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-divider text-left">
                <th className="pb-3 text-xs font-semibold text-foreground-500 w-[280px]">
                  Servicio
                </th>
                <th className="pb-3 text-xs font-semibold text-foreground-500 w-[140px]">
                  Categoría
                </th>
                <th className="pb-3 text-xs font-semibold text-foreground-500 w-[200px]">
                  Ubicaciones
                </th>
                <th className="pb-3 text-xs font-semibold text-foreground-500 w-[160px]">
                  Precio
                </th>
                <th className="pb-3 text-xs font-semibold text-foreground-500 w-[100px]">
                  Estado
                </th>
                <th className="pb-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr
                  key={svc.id}
                  className="border-b border-divider hover:bg-foreground-50 transition-colors cursor-pointer"
                >
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-foreground-100 flex items-center justify-center shrink-0">
                        <svg
                          className="w-4 h-4 text-foreground-300"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          viewBox="0 0 24 24"
                        >
                          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {svc.name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-sm text-foreground-500">
                    {svc.category}
                  </td>
                  <td className="py-4 text-sm text-foreground-500">
                    {svc.locations}
                  </td>
                  <td className="py-4 text-sm font-medium text-foreground">
                    {svc.price}
                  </td>
                  <td className="py-4">
                    <Chip color="success" size="sm" variant="soft">
                      Activo
                    </Chip>
                  </td>
                  <td className="py-4 text-foreground-400">
                    <svg
                      className="w-4.5 h-4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 6h.01M12 12h.01M12 18h.01" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
