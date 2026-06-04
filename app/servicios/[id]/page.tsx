import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { serviceToDraft } from "@/lib/services/service-to-draft";
import { ServiceDetailForm } from "@/components/servicios/service-detail-form";

export const runtime = "nodejs";

export default async function ServicioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) notFound();

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      category: true,
      locations: true,
      photos: { orderBy: { position: "asc" } },
      pricing: { include: { ranges: true } },
      optionGroups: {
        include: {
          options: { include: { pricing: { include: { ranges: true } } } },
        },
      },
    },
  });

  if (!service || service.ownerId !== userId) notFound();

  const categories = await prisma.category.findMany();
  const cats = categories
    .map((c) => ({
      id: c.id,
      name: ((c.names ?? {}) as { es?: string }).es ?? c.slug,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <ServiceDetailForm
      categories={cats}
      initial={serviceToDraft(service)}
      serviceId={id}
    />
  );
}
