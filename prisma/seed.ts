import { PrismaClient } from "@prisma/client";

import { serviceCategories } from "../config/site";
import { genId } from "../lib/id";

const prisma = new PrismaClient();

// Traducciones al ingles del catalogo en config/site.ts (en espanol = label).
const EN_NAMES: Record<string, string> = {
  actividades: "Activities & Workshops",
  catering: "Catering",
  decoracion: "Decoration",
  diseno: "Design",
  espacio: "Venue",
  fotografia: "Photography & Video",
  luces: "Lighting & Sound",
  merchandising: "Merchandising",
  mobiliario: "Furniture",
  musica: "Music",
  personal: "Staff",
  pr: "PR & Social",
  transporte: "Transportation",
};

async function main() {
  for (const cat of serviceCategories) {
    await prisma.category.upsert({
      where: { slug: cat.id },
      update: {
        names: { es: cat.label, en: EN_NAMES[cat.id] ?? cat.label },
        icon: cat.icon,
      },
      create: {
        id: genId("cate"),
        slug: cat.id,
        names: { es: cat.label, en: EN_NAMES[cat.id] ?? cat.label },
        icon: cat.icon,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed listo: ${serviceCategories.length} categorias.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
