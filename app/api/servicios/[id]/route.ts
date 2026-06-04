import { auth } from "@clerk/nextjs/server";

import { isValidDraft } from "@/lib/services/validate-draft";
import {
  ServiceForbiddenError,
  ServiceNotFoundError,
  updateService,
} from "@/lib/services/update-service";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

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
    await updateService(id, body, userId);

    return Response.json({ id }, { status: 200 });
  } catch (err) {
    if (err instanceof ServiceNotFoundError) {
      return Response.json({ error: "Servicio no encontrado." }, { status: 404 });
    }
    if (err instanceof ServiceForbiddenError) {
      return Response.json({ error: "Sin permiso." }, { status: 403 });
    }
    // eslint-disable-next-line no-console
    console.error("Error actualizando servicio:", err);

    return Response.json(
      { error: "No se pudo guardar el servicio." },
      { status: 500 },
    );
  }
}
