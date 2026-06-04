import type { ServiceDraft } from "@/types/chat";

import { auth } from "@clerk/nextjs/server";

import { saveService } from "@/lib/services/save-service";

export const runtime = "nodejs";

function isValidDraft(body: unknown): body is ServiceDraft {
  if (!body || typeof body !== "object") return false;
  const d = body as Record<string, unknown>;

  return (
    typeof d.name === "string" &&
    d.name.trim().length > 0 &&
    typeof d.category === "string" &&
    d.category.trim().length > 0 &&
    Array.isArray(d.locations) &&
    Array.isArray(d.photos) &&
    Array.isArray(d.priceRanges) &&
    Array.isArray(d.optionGroups)
  );
}

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON invalido." }, { status: 400 });
  }

  if (!isValidDraft(body)) {
    return Response.json(
      { error: "Faltan datos del servicio." },
      { status: 422 },
    );
  }

  try {
    const id = await saveService(body, userId);

    return Response.json({ id }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error guardando servicio:", err);

    return Response.json(
      { error: "No se pudo guardar el servicio." },
      { status: 500 },
    );
  }
}
