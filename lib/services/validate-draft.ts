import type { ServiceDraft } from "@/types/chat";

// Validacion minima del payload de un servicio recibido por la API.
export function isValidDraft(body: unknown): body is ServiceDraft {
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
