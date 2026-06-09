import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { auth } from "@clerk/nextjs/server";

import { saveService } from "@/lib/services/save-service";
import { serviceCategories } from "@/config/site";
import type { ServiceDraft } from "@/types/chat";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-sonnet-4-6";
const client = new AnthropicBedrock();

const CATEGORIES = serviceCategories.map((c) => c.label).join(", ");

const EXTRACT_TOOL = {
  name: "extract_services",
  description:
    "Devuelve TODOS los servicios encontrados en el/los documento(s) como una lista estructurada.",
  input_schema: {
    type: "object" as const,
    properties: {
      services: {
        type: "array",
        description: "Un objeto por cada servicio del catalogo.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nombre del servicio." },
            category: {
              type: "string",
              description: `Categoria mas adecuada (elige una de: ${CATEGORIES}).`,
            },
            description: { type: "string" },
            locations: {
              type: "array",
              items: { type: "string" },
              description: "Ubicaciones/zonas si aparecen.",
            },
            pricingModel: {
              type: "string",
              enum: ["fixed", "per_person"],
              description: "fixed = precio por evento; per_person = por pax.",
            },
            variableByHeadcount: {
              type: "boolean",
              description: "true si el precio por pax varia por rangos de personas.",
            },
            basePrice: {
              type: "number",
              description: "Precio unico (si no varia por rangos).",
            },
            priceRanges: {
              type: "array",
              description: "Rangos de precio por pax (si varia).",
              items: {
                type: "object",
                properties: {
                  from: { type: "number" },
                  to: { type: "number" },
                  price: { type: "number" },
                },
                required: ["from", "to", "price"],
                additionalProperties: false,
              },
            },
          },
          required: ["name", "category"],
          additionalProperties: false,
        },
      },
    },
    required: ["services"],
    additionalProperties: false,
  },
};

type RawService = Partial<ServiceDraft> & { name: string; category: string };

function normalize(s: RawService): ServiceDraft {
  return {
    name: String(s.name).trim(),
    category: String(s.category).trim(),
    description: typeof s.description === "string" ? s.description : "",
    locations: Array.isArray(s.locations) ? s.locations.map(String) : [],
    photos: [],
    pricingModel: s.pricingModel === "per_person" ? "per_person" : "fixed",
    variableByHeadcount: !!s.variableByHeadcount,
    basePrice: typeof s.basePrice === "number" ? s.basePrice : 0,
    priceRanges: Array.isArray(s.priceRanges) ? s.priceRanges : [],
    optionGroups: [],
  };
}

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  let file: File | null = null;

  try {
    const form = await req.formData();
    const f = form.get("file");

    if (f instanceof File && f.size > 0) file = f;
  } catch {
    return Response.json({ error: "Cuerpo invalido." }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: "No se recibio el PDF." }, { status: 400 });
  }

  const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  let extracted: RawService[];

  try {
    const msg = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 8192,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_services" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: "Analiza el documento (catalogo de servicios de un proveedor de eventos) y extrae TODOS los servicios con sus datos y precios usando la tool extract_services.",
            },
          ],
        },
      ],
    });

    const tool = msg.content.find(
      (b) => b.type === "tool_use" && b.name === "extract_services",
    );

    extracted =
      tool && tool.type === "tool_use"
        ? ((tool.input as { services?: RawService[] }).services ?? [])
        : [];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error del modelo";

    return Response.json(
      { error: `No se pudo analizar el PDF: ${message}` },
      { status: 502 },
    );
  }

  const valid = extracted.filter(
    (s) => s && typeof s.name === "string" && s.name.trim() && s.category,
  );

  if (!valid.length) {
    return Response.json(
      { error: "No encontre servicios en el documento." },
      { status: 422 },
    );
  }

  const saved: { id: string; name: string }[] = [];

  for (const raw of valid) {
    try {
      const draft = normalize(raw);
      const id = await saveService(draft, userId);

      saved.push({ id, name: draft.name });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error guardando servicio importado:", err);
    }
  }

  if (!saved.length) {
    return Response.json(
      { error: "No se pudieron guardar los servicios." },
      { status: 500 },
    );
  }

  return Response.json({ count: saved.length, services: saved });
}
